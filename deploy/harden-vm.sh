#!/usr/bin/env bash
set -euo pipefail

# Idempotent VM hardening script for veldmesh.io deployment
# Usage: harden-vm.sh [--check]
#   --check: verify hardening without making changes (exit 0 if compliant)

CHECK_MODE=false
if [[ "${1:-}" == "--check" ]]; then
  CHECK_MODE=true
fi

DEPLOY_USER="${SUDO_USER:-ubuntu}"
VM_MESH_PORT="${VM_MESH_PORT:-51820}"
VELDSITE_PATH="/opt/veldsite"
VEL_CONFIG_PATH="/etc/vel/config.toml"
ENV_FILE="${VELDSITE_PATH}/.env"
RELAY_KEY_PATH="/etc/velmesh/relay-identity.key"

log() { echo "[harden-vm] $*"; }
warn() { echo "[harden-vm] WARNING: $*" >&2; }
err() { echo "[harden-vm] ERROR: $*" >&2; }

check_ssh_config() {
  local sshd_config="/etc/ssh/sshd_config"
  local issues=()

  if ! grep -q "^PermitRootLogin no" "$sshd_config"; then
    issues+=("PermitRootLogin not set to 'no'")
  fi
  if ! grep -q "^PasswordAuthentication no" "$sshd_config"; then
    issues+=("PasswordAuthentication not set to 'no'")
  fi
  if ! grep -q "^AllowUsers.*${DEPLOY_USER}" "$sshd_config"; then
    issues+=("AllowUsers does not include ${DEPLOY_USER}")
  fi

  if [[ ${#issues[@]} -gt 0 ]]; then
    if $CHECK_MODE; then
      for issue in "${issues[@]}"; do
        err "SSH: $issue"
      done
      return 1
    fi
    log "Hardening SSH configuration..."
    sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' "$sshd_config"
    sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' "$sshd_config"
    if grep -q "^AllowUsers" "$sshd_config"; then
      sed -i "s/^AllowUsers.*/AllowUsers ${DEPLOY_USER}/" "$sshd_config"
    else
      echo "AllowUsers ${DEPLOY_USER}" >> "$sshd_config"
    fi
    systemctl reload sshd
  fi
  return 0
}

check_ufw() {
  local issues=()

  if ! ufw status | grep -q "Status: active"; then
    issues+=("UFW is not active")
  fi
  if ! ufw status | grep -q "22/tcp.*ALLOW"; then
    issues+=("UFW rule for 22/tcp (SSH) missing")
  fi
  if ! ufw status | grep -q "80/tcp.*ALLOW"; then
    issues+=("UFW rule for 80/tcp (HTTP) missing")
  fi
  if ! ufw status | grep -q "443/tcp.*ALLOW"; then
    issues+=("UFW rule for 443/tcp (HTTPS) missing")
  fi
  if ! ufw status | grep -q "${VM_MESH_PORT}/udp.*ALLOW"; then
    issues+=("UFW rule for ${VM_MESH_PORT}/udp (vel mesh) missing")
  fi
  if ! ufw status | grep -q "Default deny.*incoming"; then
    issues+=("UFW default incoming policy is not 'deny'")
  fi

  if [[ ${#issues[@]} -gt 0 ]]; then
    if $CHECK_MODE; then
      for issue in "${issues[@]}"; do
        err "UFW: $issue"
      done
      return 1
    fi
    log "Configuring UFW..."
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp comment 'SSH'
    ufw allow 80/tcp comment 'HTTP (Caddy)'
    ufw allow 443/tcp comment 'HTTPS (Caddy)'
    ufw allow "${VM_MESH_PORT}/udp" comment 'Vel mesh'
    ufw --force enable
  fi
  return 0
}

check_unattended_upgrades() {
  local issues=()
  local config="/etc/apt/apt.conf.d/50unattended-upgrades"

  if ! dpkg -l | grep -q "^ii.*unattended-upgrades"; then
    issues+=("unattended-upgrades package not installed")
  fi
  if ! grep -q 'Unattended-Upgrade::Allowed-Origins.*security' "$config" 2>/dev/null; then
    issues+=("unattended-upgrades not configured for security updates only")
  fi
  if ! systemctl is-enabled unattended-upgrades >/dev/null 2>&1; then
    issues+=("unattended-upgrades service not enabled")
  fi

  if [[ ${#issues[@]} -gt 0 ]]; then
    if $CHECK_MODE; then
      for issue in "${issues[@]}"; do
        err "unattended-upgrades: $issue"
      done
      return 1
    fi
    log "Installing and configuring unattended-upgrades..."
    apt-get update -qq
    apt-get install -y -qq unattended-upgrades
    cat > "$config" <<'EOF'
Unattended-Upgrade::Allowed-Origins {
  "${distro_id}:${distro_codename}-security";
};
Unattended-Upgrade::Package-Blacklist {
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::InstallOnShutdown "false";
Unattended-Upgrade::Mail "";
Unattended-Upgrade::MailReport "on-change";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-New-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF
    systemctl enable --now unattended-upgrades
  fi
  return 0
}

check_users() {
  local issues=()

  if ! id -u vel >/dev/null 2>&1; then
    issues+=("User 'vel' does not exist")
  fi
  if ! id -u velsite >/dev/null 2>&1; then
    issues+=("User 'velsite' does not exist")
  fi
  if [[ ! -d "/home/vel" ]]; then
    issues+=("Home directory /home/vel missing")
  fi
  if [[ ! -d "/home/velsite" ]]; then
    issues+=("Home directory /home/velsite missing")
  fi
  if [[ ! -d "$VELDSITE_PATH" ]]; then
    issues+=("Directory $VELDSITE_PATH missing")
  else
    local owner=$(stat -c '%U' "$VELDSITE_PATH")
    if [[ "$owner" != "velsite" ]]; then
      issues+=("$VELDSITE_PATH not owned by velsite (current: $owner)")
    fi
  fi

  if [[ ${#issues[@]} -gt 0 ]]; then
    if $CHECK_MODE; then
      for issue in "${issues[@]}"; do
        err "Users: $issue"
      done
      return 1
    fi
    log "Creating users and setting permissions..."
    id -u vel >/dev/null 2>&1 || useradd -r -m -d /home/vel -s /usr/sbin/nologin vel
    id -u velsite >/dev/null 2>&1 || useradd -r -m -d /home/velsite -s /usr/sbin/nologin velsite
    mkdir -p "$VELDSITE_PATH"
    chown velsite:velsite "$VELDSITE_PATH"
    chmod 750 "$VELDSITE_PATH"
  fi
  return 0
}

check_env_file() {
  local issues=()

  if [[ ! -f "$ENV_FILE" ]]; then
    issues+=("Environment file $ENV_FILE missing")
  else
    local perms=$(stat -c '%a' "$ENV_FILE")
    local owner=$(stat -c '%U' "$ENV_FILE")
    if [[ "$perms" != "600" ]]; then
      issues+=("$ENV_FILE permissions are $perms, expected 600")
    fi
    if [[ "$owner" != "velsite" ]]; then
      issues+=("$ENV_FILE owned by $owner, expected velsite")
    fi
    if ! grep -q "IRONSERVER_MESH_ADDR" "$ENV_FILE"; then
      issues+=("$ENV_FILE missing IRONSERVER_MESH_ADDR")
    fi
    if ! grep -q "WAITLIST_BEARER_TOKEN" "$ENV_FILE"; then
      issues+=("$ENV_FILE missing WAITLIST_BEARER_TOKEN")
    fi
  fi

  if [[ ${#issues[@]} -gt 0 ]]; then
    if $CHECK_MODE; then
      for issue in "${issues[@]}"; do
        err "Env file: $issue"
      done
      return 1
    fi
    log "Writing environment file $ENV_FILE..."
    cat > "$ENV_FILE" <<EOF
IRONSERVER_MESH_ADDR=${IRONSERVER_MESH_ADDR:-}
WAITLIST_BEARER_TOKEN=${WAITLIST_BEARER_TOKEN:-}
EOF
    chown velsite:velsite "$ENV_FILE"
    chmod 600 "$ENV_FILE"
  fi
  return 0
}

check_vel_config() {
  local issues=()

  if [[ ! -f "$VEL_CONFIG_PATH" ]]; then
    issues+=("Veld config $VEL_CONFIG_PATH missing")
  else
    local perms=$(stat -c '%a' "$VEL_CONFIG_PATH")
    if [[ "$perms" != "600" ]]; then
      issues+=("$VEL_CONFIG_PATH permissions are $perms, expected 600")
    fi
  fi

  if [[ ${#issues[@]} -gt 0 ]]; then
    if $CHECK_MODE; then
      for issue in "${issues[@]}"; do
        err "Veld config: $issue"
      done
      return 1
    fi
  fi
  return 0
}

check_relay_key() {
  local issues=()

  if [[ -n "${RELAY_IDENTITY_KEY_B64:-}" ]]; then
    if [[ ! -f "$RELAY_KEY_PATH" ]]; then
      issues+=("Relay identity key $RELAY_KEY_PATH missing but RELAY_IDENTITY_KEY_B64 is set")
    else
      local perms=$(stat -c '%a' "$RELAY_KEY_PATH")
      local owner=$(stat -c '%U' "$RELAY_KEY_PATH")
      if [[ "$perms" != "600" ]]; then
        issues+=("$RELAY_KEY_PATH permissions are $perms, expected 600")
      fi
      if [[ "$owner" != "velmesh-relay" ]]; then
        issues+=("$RELAY_KEY_PATH owned by $owner, expected velmesh-relay")
      fi
    fi
  fi

  if [[ ${#issues[@]} -gt 0 ]]; then
    if $CHECK_MODE; then
      for issue in "${issues[@]}"; do
        err "Relay key: $issue"
      done
      return 1
    fi
    log "Provisioning relay identity key..."
    mkdir -p /etc/velmesh
    id -u velmesh-relay >/dev/null 2>&1 || useradd -r -M -d /nonexistent -s /usr/sbin/nologin velmesh-relay
    echo "${RELAY_IDENTITY_KEY_B64}" | base64 -d > "$RELAY_KEY_PATH"
    chown velmesh-relay:velmesh-relay "$RELAY_KEY_PATH"
    chmod 600 "$RELAY_KEY_PATH"
  fi
  return 0
}

check_systemd_units() {
  local issues=()

  for unit in veldsite veld-daemon; do
    if ! systemctl is-active --quiet "$unit"; then
      issues+=("Service $unit is not active")
    fi
    local expected_user=""
    if [[ "$unit" == "velsite" ]]; then
      expected_user="velsite"
    elif [[ "$unit" == "vel-daemon" ]]; then
      expected_user="vel"
    fi
    if [[ -n "$expected_user" ]]; then
      local actual_user=$(systemctl show -p User --value "$unit" 2>/dev/null || echo "")
      if [[ "$actual_user" != "$expected_user" ]]; then
        issues+=("Service $unit runs as user '$actual_user', expected '$expected_user'")
      fi
    fi
  done

  if [[ ${#issues[@]} -gt 0 ]]; then
    if $CHECK_MODE; then
      for issue in "${issues[@]}"; do
        err "Systemd: $issue"
      done
      return 1
    fi
  fi
  return 0
}

main() {
  local all_ok=true

  check_ssh_config || all_ok=false
  check_ufw || all_ok=false
  check_unattended_upgrades || all_ok=false
  check_users || all_ok=false
  check_env_file || all_ok=false
  check_vel_config || all_ok=false
  check_relay_key || all_ok=false
  check_systemd_units || all_ok=false

  if $CHECK_MODE; then
    if $all_ok; then
      log "All hardening checks passed."
      exit 0
    else
      err "Some hardening checks failed."
      exit 1
    fi
  else
    if $all_ok; then
      log "Hardening complete (all checks already satisfied)."
    else
      log "Hardening applied."
    fi
  fi
}

main "$@"