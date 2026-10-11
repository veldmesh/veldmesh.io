// Copyright (c) 2026 Ironfeast Media, LLC. All rights reserved.
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Running Veldmesh Alongside Commercial VPNs — Veldmesh",
  description:
    "Veldmesh and commercial VPNs (ExpressVPN, NordVPN, Mullvad, ProtonVPN, etc.) can run on the same machine at the same time. This page explains why it works, how to set it up, and what to watch for.",
}

export default function CommercialVpnsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="mb-10 text-3xl font-bold text-slate-900">
        Running Veldmesh Alongside Commercial VPNs
      </h1>

      <section className="prose prose-slate max-w-none">
        <p>
          Veldmesh and commercial VPNs (ExpressVPN, NordVPN, Mullvad, ProtonVPN, etc.) can run on
          the same machine at the same time. This page explains why it works, how to set it up,
          and what to watch for.
        </p>
        <p>
          Veldmesh peers are not WireGuard peers &mdash; veld is a separate daemon with its own
          protocol. When you configure split-tunnel exclusions, add the <code>veld</code>
          binary/process to the exclusion list; WireGuard-style <code>AllowedIPs</code> entries
          don&rsquo;t apply.
        </p>

        <h2 id="why-it-works">Why it works: split-tunnel by architecture</h2>
        <p>
          Veldmesh never installs a default route, has no exit node, and no full-tunnel mode. It
          adds routes only for:
        </p>
        <ul>
          <li>
            The mesh CIDR assigned by the coordination server (managed mode:{" "}
            <code>10.100.0.0/24</code> by default; self-hosted coord: you choose via{" "}
            <code>--network-cidr</code>)
          </li>
          <li>Subnet routes advertised by peers (Linux only; no-op on macOS/Windows)</li>
        </ul>
        <p>
          A commercial VPN typically pushes a default route (<code>0.0.0.0/0</code>).
          Veldmesh&rsquo;s more-specific mesh routes win for mesh traffic automatically.
        </p>
        <p>
          <strong>The catch:</strong> Veldmesh&rsquo;s own encrypted UDP &mdash; to peers, the
          coordination server, STUN, and relay (if configured) &mdash; goes to public IPs, so it
          travels through the commercial VPN tunnel and leaves from the provider&rsquo;s IP.
          Hole punching therefore usually fails behind the provider&rsquo;s NAT unless relay
          fallback is configured and working.
        </p>
        <p>
          The practical fix: exclude the <code>veld</code> daemon from the commercial VPN using
          the provider&rsquo;s split-tunnel feature. A kill switch / Network Lock blocks it
          outright.
        </p>

        <h2 id="step-by-step">Step-by-step</h2>
        <p>
          Order does not matter &mdash; connect Veldmesh first, then the commercial VPN, or the
          reverse. The mesh routes are more specific than a default routing entry, so they stay
          reachable.
        </p>
        <ol>
          <li>
            <strong>Run Veldmesh</strong> (<code>veld up</code> or the systemd service).
            <ul>
              <li>
                It creates a TUN device and adds mesh routes via netlink (Linux) or the platform
                equivalent.
              </li>
              <li>
                The TUN interface name is shown by <code>veld status</code> &mdash; you can
                override it with <code>node.iface_name</code> in the config.
              </li>
            </ul>
          </li>
          <li>
            <strong>Start your commercial VPN</strong>.
            <ul>
              <li>
                If it has a kill switch / Network Lock: <strong>disable it</strong> or add a
                split-tunnel bypass for the <code>veld</code> binary. The kill switch is the only
                thing that breaks coexistence at the VPN side.
              </li>
            </ul>
          </li>
          <li>
            <strong>Verify</strong>:
            <ul>
              <li>
                <code>ip route</code> (or your platform equivalent) shows the mesh routes for
                your network&rsquo;s range.
              </li>
              <li>
                <code>veld status</code> shows the TUN interface and assigned mesh address.
              </li>
              <li>
                <code>ping &lt;peer-mesh-ip&gt;</code> works.
              </li>
              <li>Public internet still goes through the commercial VPN.</li>
            </ul>
          </li>
        </ol>

        <h2 id="expressvpn">ExpressVPN specifics</h2>
        <ul>
          <li>
            <strong>Network Lock (kill switch) must be off</strong>, or you must add a
            split-tunnel exception.
          </li>
          <li>
            ExpressVPN&rsquo;s split tunneling is app-based on desktop (Windows, Mac, Linux). Add
            the <code>veld</code> binary to the &ldquo;don&rsquo;t use VPN&rdquo; list. On Linux
            you can do this on the command line, e.g.{" "}
            <code>expressvpnctl set split-app</code> &mdash; see{" "}
            <a href="https://www.expressvpn.com/support/knowledge-hub/split-tunneling-desktop/">
              ExpressVPN&rsquo;s split tunneling guide
            </a>{" "}
            for current steps.
          </li>
          <li>
            ExpressVPN&rsquo;s desktop split tunneling works per app (and, on Windows, per
            website) &mdash; there is no raw-CIDR exclusion. Exclude the <code>veld</code> daemon
            itself; mesh IPs belong to no website.
          </li>
        </ul>

        <h2 id="mullvad-protonvpn">Mullvad / ProtonVPN / WireGuard configs</h2>
        <p>
          These providers use Linux fwmark / nftables for split-tunnelling. The principle is the
          same: exempt the <code>veld</code> daemon and/or the mesh CIDR from the VPN&rsquo;s
          marking rules.
        </p>
        <ul>
          <li>
            <strong>Mullvad</strong>: exclude the <code>veld</code> binary with{" "}
            <code>mullvad-exclude &lt;program&gt;</code> or{" "}
            <code>mullvad split-tunnel add &lt;pid&gt;</code> &mdash; see{" "}
            <a href="https://mullvad.net/en/help/split-tunneling-with-the-mullvad-app">
              Mullvad&rsquo;s split tunneling guide
            </a>
            . For excluding specific IPs/CIDRs on Linux, Mullvad documents its own{" "}
            <a href="https://mullvad.net/en/help/split-tunneling-with-linux-advanced">
              advanced nftables approach
            </a>
            .
          </li>
          <li>
            <strong>ProtonVPN</strong>: use the app&rsquo;s split tunneling (Exclude mode; paid
            plans) to keep the <code>veld</code> binary outside the tunnel &mdash; see{" "}
            <a href="https://protonvpn.com/support/protonvpn-split-tunneling">
              Proton VPN&rsquo;s split tunneling guide
            </a>
            . Note their own docs say split tunneling and the kill switch are mutually exclusive
            on most platforms &mdash; with the kill switch on, coexistence is blocked.
          </li>
          <li>
            Do not add <code>AllowedIPs = 0.0.0.0/0</code> on a Veldmesh peer &mdash; Veldmesh
            peers are not WireGuard peers.
          </li>
        </ul>

        <h2 id="cidr-selection">CIDR selection guidance</h2>
        <table>
          <thead>
            <tr>
              <th>CIDR</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>10.0.0.0/8</code>
              </td>
              <td>Too broad &mdash; high collision risk with corporate VPNs</td>
            </tr>
            <tr>
              <td>
                <code>100.64.0.0/10</code>
              </td>
              <td>
                <strong>Avoid</strong> &mdash; CGNAT shared address space
              </td>
            </tr>
            <tr>
              <td>
                <code>172.16.0.0/12</code>
              </td>
              <td>
                Common in Docker / corporate &mdash; use a <code>/16</code> slice you control
              </td>
            </tr>
            <tr>
              <td>
                <code>192.168.0.0/16</code>
              </td>
              <td>
                Common LAN &mdash; avoid unless you own the whole <code>/16</code>
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          In managed mode the mesh CIDR is assigned by the coordination server (
          <code>10.100.0.0/24</code> by default). If you self-host the coordinator, choose a
          range that does not overlap your LAN, your VPN provider&rsquo;s subnets, or any
          corporate ranges you reach.
        </p>
        <p>IPv6 mesh addresses are not supported/verified.</p>

        <h2 id="what-breaks">What breaks</h2>
        <table>
          <thead>
            <tr>
              <th>Blocker</th>
              <th>Why</th>
              <th>Fix</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Commercial VPN kill switch / Network Lock</td>
              <td>Drops all traffic not matching the VPN&rsquo;s allowed list</td>
              <td>
                Disable kill switch, or add split-tunnel bypass for <code>veld</code> binary +
                mesh CIDR
              </td>
            </tr>
            <tr>
              <td>
                Split tunneling and kill switch mutually exclusive (ProtonVPN, most platforms)
              </td>
              <td>Can&rsquo;t exclude the daemon while keeping the kill switch</td>
              <td>
                Disable the kill switch; if you need both, full-tunnel coexistence is not
                possible
              </td>
            </tr>
            <tr>
              <td>
                Commercial VPN forces <code>AllowedIPs = 0.0.0.0/0</code> on its WireGuard peer
              </td>
              <td>Captures all traffic</td>
              <td>Use the provider&rsquo;s split-tunnel feature instead of manual config</td>
            </tr>
            <tr>
              <td>Veldmesh subnet routes overlapping VPN subnet</td>
              <td>Route conflict</td>
              <td>
                Don&rsquo;t advertise subnets that overlap your VPN provider&rsquo;s ranges
              </td>
            </tr>
            <tr>
              <td>Relay fallback not configured</td>
              <td>Hole punching fails behind provider&rsquo;s NAT</td>
              <td>
                Set <code>relay_addr</code> and <code>relay_x25519</code> in config to enable
                volunteer peer relay
              </td>
            </tr>
          </tbody>
        </table>

        <h2 id="comparison">Comparison: Veldmesh vs Tailscale vs ZeroTier</h2>
        <table>
          <thead>
            <tr>
              <th>Behavior</th>
              <th>Veldmesh</th>
              <th>Tailscale</th>
              <th>ZeroTier</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Default route installed?</td>
              <td>
                <strong>Never</strong>
              </td>
              <td>Optional (exit node)</td>
              <td>Optional</td>
            </tr>
            <tr>
              <td>Coexists with commercial VPN kill switch?</td>
              <td>
                <strong>Yes (with split-tunnel bypass)</strong>
              </td>
              <td>Requires provider-specific workarounds</td>
              <td>Requires provider-specific workarounds</td>
            </tr>
            <tr>
              <td>Mesh CIDR</td>
              <td>Assigned by coord (managed) or admin-chosen (self-hosted)</td>
              <td>Fixed 100.x.y.z (CGNAT)</td>
              <td>Admin-chosen</td>
            </tr>
            <tr>
              <td>Relay fallback for symmetric NAT?</td>
              <td>
                <strong>Implemented</strong> (volunteer peer relay; requires config)
              </td>
              <td>DERP (open source, self-hostable)</td>
              <td>Moons (self-hostable)</td>
            </tr>
            <tr>
              <td>Mobile (iOS/Android)</td>
              <td>Not yet</td>
              <td>Yes</td>
              <td>Yes</td>
            </tr>
          </tbody>
        </table>

        <h2 id="caveats">Caveats</h2>
        <ul>
          <li>
            Provider UIs change often. If the split-tunnel steps above don&rsquo;t match what you
            see, the principle still holds: bypass the <code>veld</code> binary and the mesh
            CIDR, and test your combination.
          </li>
          <li>
            Running two encrypted tunnels means mesh traffic is encrypted once by Veldmesh (and
            veld&rsquo;s control traffic may be encrypted again by the commercial VPN when it
            transits the tunnel). Benchmark your workload if throughput matters.
          </li>
          <li>
            Veldmesh&rsquo;s control traffic (coordination, STUN, relay) follows your default
            route &mdash; through the commercial VPN unless you exclude the daemon. That affects
            how peers connect, not the privacy of mesh traffic itself.
          </li>
        </ul>

        <hr />
        <p>
          <em>
            Page content grounded in veld&rsquo;s route manager (mesh routes only, no default
            route), relay fallback (requires config), and platform TUN handling. For
            provider-specific steps, follow the linked provider guides.
          </em>
        </p>
      </section>
    </div>
  )
}
