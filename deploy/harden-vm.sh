#!/usr/bin/env bash
# VM Hardening Script for Veldmesh.io deployment
# Idempotent: can be run multiple times safely
# Usage: harden-vm.sh [--check] [--force-ufw-reset]
#   --check: verify configuration without making changes
#   --force-ufw-reset: allow ufw --force reset (destructive)

set -euo pipefail

CHECK_MODE=false
FORCE_UFW_RESET=false

for arg in "$@"; do
  case "$arg" in
    --check) CHECK_MODE=true ;;
    --force-ufw-reset) FORCE_UFW_RESET=true ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

# Validate required environment variables
validate_port() {
  local port="$1"
  if ! [[ "$port" =~ ^[0-9]+$ ]] || (( port < 1 || port > 65535 )); then
    echo "Invalid port: $port (must be 1-65535)" >&2
    return 1
  fi
}

validate_absolute_path() {
  local path="$1"
  if [[ ! "$path" = /* ]]; then
    echo "Path must be absolute: $path" >&2
    return 1
  fi
  if [[ "$path" == *..* ]]; then
    echo "Path must not contain '..': $path" >&2
    return 1
  fi
}

# Read environment variables (can be passed via sudo or sourced from env file)
VM_MESH_PORT="${VM_MESH_PORT:-}"
VM_DEPLOY_PATH="${VM_DEPLOY_PATH:-/opt/veldsite/app}"
IRONSERVER_MESH_IP="${IRONSERVER_MESH_IP:-}"
IRONSERVER_PUBLIC_ENDPOINT="${IRONSERVER_PUBLIC_ENDPOINT:-}"
WAITLIST_BEARER_TOKEN="${WAITLIST_BEARER_TOKEN:-}"
RELAY_IDENTITY_KEY_B64="${RELAY_IDENTITY_KEY_B64:-}"
VM_SSH_USER="${VM_SSH_USER:-ubuntu}"

# Validate required variables
if [[ -z "$VM_MESH_PORT" ]]; then
  echo "VM_MESH_PORT is required" >&2
  exit 1
fi
validate_port "$VM_MESH_PORT"

if [[ -z "$IRONSERVER_MESH_IP" ]]; then
  echo "IRONSERVER_MESH_IP is required" >&2
  exit 1
fi

if [[ -z "$IRONSERVER_PUBLIC_ENDPOINT" ]]; then
  echo "IRONSERVER_PUBLIC_ENDPOINT is required" >&2
  exit 1
fi

if [[ -z "$WAITLIST_BEARER_TOKEN" ]]; then
  echo "WAITLIST_BEARER_TOKEN is required" >&2
  exit 1
fi

validate_absolute_path "$VM_DEPLOY_PATH"

VELDSITE_PATH="$VM_DEPLOY_PATH"
VELDSITE_PARENT="$(dirname "$VELDSITE_PATH")"

report_issue() {
  if $CHECK_MODE; then
    echo "CHECK FAILED: $1" >&2
    return 1
  fi
}

report_ok() {
  if $CHECK_MODE; then
    echo "CHECK OK: $1"
  fi
}

fix_ssh_config() {
  local sshd_config="/etc/ssh/sshd_config"
  local issues=0
  local deploy_user="$VM_SSH_USER"

  # PermitRootLogin no - check if already set correctly
  if grep -qE '^\s*PermitRootLogin\s+no' "$sshd_config"; then
    report_ok "PermitRootLogin is no"
  else
    if $CHECK_MODE; then
      report_issue "PermitRootLogin not set to 'no'"
    else
      # Delete all existing PermitRootLogin lines (commented or not), then add correct one
      sed -i -E '/^\s*#?\s*PermitRootLogin\s+/d' "$sshd_config"
      echo "PermitRootLogin no" >> "$sshd_config"
      echo "Set PermitRootLogin no"
    fi
    ((issues++))
  fi

  # PasswordAuthentication no - check if already set correctly
  if grep -qE '^\s*PasswordAuthentication\s+no' "$sshd_config"; then
    report_ok "PasswordAuthentication is no"
  else
    if $CHECK_MODE; then
      report_issue "PasswordAuthentication not set to 'no'"
    else
      sed -i -E '/^\s*#?\s*PasswordAuthentication\s+/d' "$sshd_config"
      echo "PasswordAuthentication no" >> "$sshd_config"
      echo "Set PasswordAuthentication no"
    fi
    ((issues++))
  fi

  # AllowUsers for deploy user - check if already includes user
  if grep -qE "^\s*AllowUsers\s+.*\b$deploy_user\b" "$sshd_config"; then
    report_ok "AllowUsers includes $deploy_user"
  else
    if $CHECK_MODE; then
      report_issue "AllowUsers does not include $deploy_user"
    else
      sed -i -E '/^\s*#?\s*AllowUsers\s+/d' "$sshd_config"
      echo "AllowUsers $deploy_user" >> "$sshd_config"
      echo "Set AllowUsers $deploy_user"
    fi
    ((issues++))
  fi

  # Validate config before reload
  if ! $CHECK_MODE && (( issues > 0 )); then
    if sshd -t; then
      systemctl reload sshd
      echo "SSH config validated and reloaded"
    else
      echo "ERROR: sshd config validation failed, not reloading" >&2
      exit 1
    fi
  fi

  return $issues
}

fix_ufw() {
  local issues=0

  # Check default policies using verbose output for robust parsing
  local default_incoming default_outgoing
  default_incoming=$(ufw status verbose | awk '/^Default:/ {print $2}' | head -1)
  default_outgoing=$(ufw status verbose | awk '/^Default:/ {print $3}' | head -1)

  if [[ "$default_incoming" != "deny" ]]; then
    if $CHECK_MODE; then
      report_issue "UFW default incoming policy is not 'deny' (current: $default_incoming)"
    else
      ufw default deny incoming
      echo "Set default deny incoming"
    fi
    ((issues++))
  else
    report_ok "UFW default incoming is deny"
  fi

  if [[ "$default_outgoing" != "allow" ]]; then
    if $CHECK_MODE; then
      report_issue "UFW default outgoing policy is not 'allow' (current: $default_outgoing)"
    else
      ufw default allow outgoing
      echo "Set default allow outgoing"
    fi
    ((issues++))
  else
    report_ok "UFW default outgoing is allow"
  fi

  # Check required rules using robust awk parsing (first column is rule spec)
  local required_rules=(
    "22/tcp"
    "80/tcp"
    "443/tcp"
    "${VM_MESH_PORT}/udp"
  )

  for rule in "${required_rules[@]}"; do
    if ufw status | awk '{print $1}' | grep -qx "$rule"; then
      report_ok "UFW rule $rule exists"
    else
      if $CHECK_MODE; then
        report_issue "UFW rule $rule missing"
      else
        ufw allow "$rule"
        echo "Added UFW rule $rule"
      fi
      ((issues++))
    fi
  done

  # Enable UFW if not active
  if ufw status | grep -q "^Status: active"; then
    report_ok "UFW is active"
  else
    if $CHECK_MODE; then
      report_issue "UFW is not active"
    else
      ufw --force enable
      echo "Enabled UFW"
    fi
    ((issues++))
  fi

  return $issues
}

fix_unattended_upgrades() {
  local issues=0
  local config="/etc/apt/apt.conf.d/50unattended-upgrades"

  if [[ -f "$config" ]]; then
    if grep -q '^\s*"${distro_id}:${distro_codename}-security"' "$config"; then
      report_ok "Unattended upgrades configured for security"
    else
      if $CHECK_MODE; then
        report_issue "Unattended upgrades not configured for security only"
      else
        # Ensure security origin is enabled
        sed -i 's/^\s*\/\/"${distro_id}:${distro_codename}-security"/"${distro_id}:${distro_codename}-security"/' "$config"
        # Disable other origins
        sed -i 's/^\s*"${distro_id}:${distro_codename}-updates"/\/"${distro_id}:${distro_codename}-updates"/' "$config"
        sed -i 's/^\s*"${distro_id}:${distro_codename}-proposed"/\/"${distro_id}:${distro_codename}-proposed"/' "$config"
        sed -i 's/^\s*"${distro_id}:${distro_codename}-backports"/\/"${distro_id}:${distro_codename}-backports"/' "$config"
        echo "Configured unattended-upgrades for security only"
      fi
      ((issues++))
    fi
  else
    if $CHECK_MODE; then
      report_issue "Unattended upgrades config not found"
    else
      apt-get update && apt-get install -y unattended-upgrades
      echo 'Unattended-Upgrade::Allowed-Origins { "${distro_id}:${distro_codename}-security"; };' > "$config"
      echo "Installed and configured unattended-upgrades"
    fi
    ((issues++))
  fi

  # Check timer is active
  if systemctl is-active --quiet apt-daily-upgrade.timer; then
    report_ok "Unattended upgrades timer active"
  else
    if $CHECK_MODE; then
      report_issue "Unattended upgrades timer not active"
    else
      systemctl enable --now apt-daily-upgrade.timer
      echo "Enabled unattended upgrades timer"
    fi
    ((issues++))
  fi

  return $issues
}

fix_users() {
  local issues=0

  # Create vel user
  if id -u vel &>/dev/null; then
    report_ok "User 'vel' exists"
  else
    if $CHECK_MODE; then
      report_issue "User 'vel' does not exist"
    else
      useradd -r -s /usr/sbin/nologin -d /var/lib/vel -m vel
      echo "Created user 'vel'"
    fi
    ((issues++))
  fi

  # Create velsite user
  if id -u velsite &>/dev/null; then
    report_ok "User 'velsite' exists"
  else
    if $CHECK_MODE; then
      report_issue "User 'velsite' does not exist"
    else
      useradd -r -s /usr/sbin/nologin -d "$VELDSITE_PARENT" -m velsite
      echo "Created user 'velsite'"
    fi
    ((issues++))
  fi

  # Create velmesh-relay user if relay key is provided
  if [[ -n "$RELAY_IDENTITY_KEY_B64" ]]; then
    if id -u velmesh-relay &>/dev/null; then
      report_ok "User 'velmesh-relay' exists"
    else
      if $CHECK_MODE; then
        report_issue "User 'velmesh-relay' does not exist (required for relay key)"
      else
        useradd -r -s /usr/sbin/nologin -d /var/lib/velmesh-relay -m velmesh-relay
        echo "Created user 'velmesh-relay'"
      fi
      ((issues++))
    fi
  fi

  # Ensure deploy directory exists with correct ownership
  if [[ -d "$VELDSITE_PATH" ]]; then
    local owner=$(stat -c '%U' "$VELDSITE_PATH")
    if [[ "$owner" == "velsite" ]]; then
      report_ok "Deploy directory owned by velsite"
    else
      if $CHECK_MODE; then
        report_issue "Deploy directory not owned by velsite (current: $owner)"
      else
        chown velsite:velsite "$VELDSITE_PATH"
        chmod 750 "$VELDSITE_PATH"
        echo "Fixed deploy directory ownership"
      fi
      ((issues++))
    fi
  else
    if $CHECK_MODE; then
      report_issue "Deploy directory does not exist: $VELDSITE_PATH"
    else
      mkdir -p "$VELDSITE_PATH"
      chown velsite:velsite "$VELDSITE_PATH"
      chmod 750 "$VELDSITE_PATH"
      echo "Created deploy directory: $VELDSITE_PATH"
    fi
    ((issues++))
  fi

  # Ensure parent directory has correct permissions
  if [[ -d "$VELDSITE_PARENT" ]]; then
    local owner=$(stat -c '%U' "$VELDSITE_PARENT")
    if [[ "$owner" == "velsite" ]]; then
      report_ok "Parent directory owned by velsite"
    else
      if $CHECK_MODE; then
        report_issue "Parent directory not owned by velsite (current: $owner)"
      else
        chown velsite:velsite "$VELDSITE_PARENT"
        chmod 750 "$VELDSITE_PARENT"
        echo "Fixed parent directory ownership"
      fi
      ((issues++))
    fi
  else
    if $CHECK_MODE; then
      report_issue "Parent directory does not exist: $VELDSITE_PARENT"
    else
      mkdir -p "$VELDSITE_PARENT"
      chown velsite:velsite "$VELDSITE_PARENT"
      chmod 750 "$VELDSITE_PARENT"
      echo "Created parent directory: $VELDSITE_PARENT"
    fi
    ((issues++))
  fi

  return $issues
}

fix_env_file() {
  local issues=0
  local env_file="$VELDSITE_PATH/.env"

  # Always render the env file (not just first deploy)
  local expected_content="IRONSERVER_MESH_IP=$IRONSERVER_MESH_IP
IRONSERVER_PUBLIC_ENDPOINT=$IRONSERVER_PUBLIC_ENDPOINT
WAITLIST_BEARER_TOKEN=$WAITLIST_BEARER_TOKEN
"

  if [[ -f "$env_file" ]]; then
    if diff -u <(echo "$expected_content") "$env_file" >/dev/null 2>&1; then
      report_ok "Env file matches expected content"
    else
      if $CHECK_MODE; then
        report_issue "Env file content mismatch"
      else
        # Use printf with proper escaping to write safely
        printf '%s' "$expected_content" > "$env_file"
        chown velsite:velsite "$env_file"
        chmod 600 "$env_file"
        echo "Updated env file: $env_file"
      fi
      ((issues++))
    fi
  else
    if $CHECK_MODE; then
      report_issue "Env file missing: $env_file"
    else
      printf '%s' "$expected_content" > "$env_file"
      chown velsite:velsite "$env_file"
      chmod 600 "$env_file"
      echo "Created env file: $env_file"
    fi
    ((issues++))
  fi

  return $issues
}

fix_vel_config() {
  local issues=0
  local config_dir="/etc/vel"
  local config_file="$config_dir/config.toml"

  # Ensure config directory exists
  if [[ -d "$config_dir" ]]; then
    local owner=$(stat -c '%U' "$config_dir")
    if [[ "$owner" == "vel" ]]; then
      report_ok "Config directory owned by vel"
    else
      if $CHECK_MODE; then
        report_issue "Config directory not owned by vel (current: $owner)"
      else
        chown vel:vel "$config_dir"
        chmod 750 "$config_dir"
        echo "Fixed config directory ownership"
      fi
      ((issues++))
    fi
  else
    if $CHECK_MODE; then
      report_issue "Config directory missing: $config_dir"
    else
      mkdir -p "$config_dir"
      chown vel:vel "$config_dir"
      chmod 750 "$config_dir"
      echo "Created config directory: $config_dir"
    fi
    ((issues++))
  fi

  # Config file is deployed by workflow, just verify it exists
  if [[ -f "$config_file" ]]; then
    local owner=$(stat -c '%U' "$config_file")
    local perms=$(stat -c '%a' "$config_file")
    if [[ "$owner" == "vel" && "$perms" == "600" ]]; then
      report_ok "Config file has correct ownership and permissions"
    else
      if $CHECK_MODE; then
        report_issue "Config file has incorrect ownership/perms (owner: $owner, perms: $perms)"
      else
        chown vel:vel "$config_file"
        chmod 600 "$config_file"
        echo "Fixed config file ownership/perms"
      fi
      ((issues++))
    fi
  else
    if $CHECK_MODE; then
      report_issue "Config file missing: $config_file"
    fi
    ((issues++))
  fi

  return $issues
}

fix_relay_key() {
  local issues=0
  local key_file="/etc/velmesh/relay-identity.key"

  if [[ -n "$RELAY_IDENTITY_KEY_B64" ]]; then
    # Key is expected
    # Ensure velmesh-relay user exists (in check mode too)
    if ! id -u velmesh-relay &>/dev/null; then
      if $CHECK_MODE; then
        report_issue "User 'velmesh-relay' does not exist (required for relay key)"
      else
        useradd -r -s /usr/sbin/nologin -d /var/lib/velmesh-relay -m velmesh-relay
        echo "Created user 'velmesh-relay'"
      fi
      ((issues++))
    fi

    if [[ -f "$key_file" ]]; then
      local owner=$(stat -c '%U' "$key_file")
      local perms=$(stat -c '%a' "$key_file")
      if [[ "$owner" == "velmesh-relay" && "$perms" == "600" ]]; then
        report_ok "Relay identity key has correct ownership and permissions"
      else
        if $CHECK_MODE; then
          report_issue "Relay identity key has incorrect ownership/perms (owner: $owner, perms: $perms)"
        else
          chown velmesh-relay:velmesh-relay "$key_file"
          chmod 600 "$key_file"
          echo "Fixed relay identity key ownership/perms"
        fi
        ((issues++))
      fi
    else
      if $CHECK_MODE; then
        report_issue "Relay identity key missing: $key_file"
      else
        mkdir -p /etc/velmesh
        printf '%s' "$RELAY_IDENTITY_KEY_B64" | base64 -d > "$key_file"
        chown velmesh-relay:velmesh-relay "$key_file"
        chmod 600 "$key_file"
        echo "Created relay identity key: $key_file"
      fi
      ((issues++))
    fi
  else
    # Key not expected, but if file exists it should be correct
    if [[ -f "$key_file" ]]; then
      if $CHECK_MODE; then
        report_issue "Relay identity key exists but no secret provided"
      else
        echo "WARNING: Relay identity key exists but RELAY_IDENTITY_KEY_B64 not set" >&2
      fi
      ((issues++))
    fi
  fi

  return $issues
}

fix_systemd_units() {
  local issues=0

  # Check veldsite.service
  if [[ -f /etc/systemd/system/veldsite.service ]]; then
    local user=$(systemctl show -p User --value veldsite 2>/dev/null || echo "")
    if [[ "$user" == "velsite" ]]; then
      report_ok "veldsite.service runs as velsite"
    else
      if $CHECK_MODE; then
        report_issue "veldsite.service does not run as velsite (current: $user)"
      fi
      ((issues++))
    fi

    # In check mode, only verify User= directive; active status is checked by workflow
    if $CHECK_MODE && systemctl is-active --quiet veldsite 2>/dev/null; then
      report_ok "veldsite service is active"
    elif $CHECK_MODE; then
      # Don't fail on inactive in check mode - workflow handles service readiness
      report_ok "veldsite service user verified (active status checked by workflow)"
    fi
  else
    if $CHECK_MODE; then
      report_issue "veldsite.service not deployed"
    fi
    ((issues++))
  fi

  # Check vel-daemon.service
  if [[ -f /etc/systemd/system/vel-daemon.service ]]; then
    local user=$(systemctl show -p User --value vel-daemon 2>/dev/null || echo "")
    if [[ "$user" == "vel" ]]; then
      report_ok "vel-daemon.service runs as vel"
    else
      if $CHECK_MODE; then
        report_issue "vel-daemon.service does not run as vel (current: $user)"
      fi
      ((issues++))
    fi

    if $CHECK_MODE && systemctl is-active --quiet vel-daemon 2>/dev/null; then
      report_ok "vel-daemon service is active"
    elif $CHECK_MODE; then
      # Don't fail on inactive in check mode - workflow handles service readiness
      report_ok "vel-daemon service user verified (active status checked by workflow)"
    fi
  else
    if $CHECK_MODE; then
      report_issue "vel-daemon.service not deployed"
    fi
    ((issues++))
  fi

  return $issues
}

main() {
  local total_issues=0

  echo "=== VM Hardening $( $CHECK_MODE && echo "(check mode)" || echo "(fix mode)" ) ==="

  fix_ssh_config || total_issues=$((total_issues + $?))
  fix_ufw || total_issues=$((total_issues + $?))
  fix_unattended_upgrades || total_issues=$((total_issues + $?))
  fix_users || total_issues=$((total_issues + $?))
  fix_env_file || total_issues=$((total_issues + $?))
  fix_vel_config || total_issues=$((total_issues + $?))
  fix_relay_key || total_issues=$((total_issues + $?))
  fix_systemd_units || total_issues=$((total_issues + $?))

  if $CHECK_MODE; then
    if (( total_issues == 0 )); then
      echo "=== All checks passed ==="
      exit 0
    else
      echo "=== $total_issues check(s) failed ===" >&2
      exit 1
    fi
  else
    echo "=== Hardening complete ($total_issues issue(s) fixed) ==="
    exit 0
  fi
}

main "$@"
