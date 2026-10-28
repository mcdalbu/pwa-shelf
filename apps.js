import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

// Parse arguments instead of searching the whole command: names and URLs may
// contain strings resembling flags. DesktopAppInfo handles actual launching.
export function describeApp(info) {
    const id = info.get_id();
    if (!id || !info.should_show())
        return null;
    let argv;
    try {
        [, argv] = GLib.shell_parse_argv(info.get_commandline() ?? '');
    } catch {
        return null;
    }
    const appId = argv.find(arg => /^--app-id=[a-p]{32}$/.test(arg))?.slice(9);
    const browser = argv.some(arg => /^(?:google-chrome(?:-stable|-beta|-unstable)?|chrome|chromium(?:-browser)?(?:\.sh)?|com\.google\.Chrome|org\.chromium\.Chromium)$/.test(GLib.path_get_basename(arg)));
    if (!appId || !browser)
        return null;
    return {
        id, appId, info,
        name: info.get_display_name(),
        wmClass: info.get_startup_wm_class(),
    };
}

export function discoverApps() {
    return Gio.AppInfo.get_all()
        .map(describeApp)
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function matchApp(apps, desktopId, identities) {
    const exact = apps.find(app => app.id === desktopId);
    if (exact)
        return exact;
    const candidates = apps.filter(app => identities.some(identity =>
        identity && (identity === app.wmClass || identity === `crx_${app.appId}` ||
            identity === app.id || `${identity}.desktop` === app.id)));
    // Chromium can reuse WM_CLASS across profiles. Never control an arbitrary
    // profile when the compositor cannot distinguish them.
    return candidates.length === 1 ? candidates[0] : null;
}
