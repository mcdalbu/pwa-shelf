import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {discoverApps, matchApp} from './apps.js';

export default class PwaShelf extends Extension {
    enable() {
        this._signals = [];
        this._windows = new Map();
        this._buttons = new Map();
        this._settings = this.getSettings();
        this._tracker = Shell.WindowTracker.get_default();
        this._monitor = Gio.AppInfoMonitor.get();
        this._connect(this._settings, 'changed::excluded-apps', () => this._reload());
        this._connect(this._monitor, 'changed', () => this._scheduleReload());
        this._connect(this._tracker, 'tracked-windows-changed', () => this._refresh());
        this._connect(global.display, 'notify::focus-window', () => this._refresh());
        this._connect(global.display, 'window-created', (_display, window) => {
            this._watch(window);
            this._refresh();
        });
        for (const actor of global.get_window_actors())
            this._watch(actor.meta_window);
        this._reload();
    }

    _connect(object, signal, callback) {
        this._signals.push([object, object.connect(signal, callback)]);
    }

    _watch(window) {
        if (this._windows.has(window))
            return;
        const ids = ['notify::minimized', 'notify::wm-class',
            'notify::gtk-application-id', 'notify::demands-attention']
            .map(signal => window.connect(signal, () => this._refresh()));
        ids.push(window.connect('unmanaged', () => {
            for (const id of this._windows.get(window) ?? [])
                window.disconnect(id);
            this._windows.delete(window);
            this._refresh();
        }));
        this._windows.set(window, ids);
    }

    _scheduleReload() {
        if (this._reloadSource)
            return;
        this._reloadSource = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            this._reloadSource = 0;
            this._reload();
            return GLib.SOURCE_REMOVE;
        });
    }

    _reload() {
        for (const button of this._buttons.values())
            button.destroy();
        this._buttons.clear();
        // Match against ALL entries, including excluded profiles, to avoid
        // incorrectly assigning their windows to a visible profile.
        this._apps = discoverApps();
        const excluded = new Set(this._settings.get_strv('excluded-apps'));
        for (const app of this._apps) {
            if (excluded.has(app.id))
                continue;
            const button = new PanelMenu.Button(0.0, app.name);
            button.add_child(new St.Icon({
                gicon: app.info.get_icon() ?? Gio.ThemedIcon.new('web-browser-symbolic'),
                style_class: 'system-status-icon',
                icon_size: 20,
            }));
            button.add_style_class_name('pwa-shelf-button');
            button.menu.addAction(app.name, () => this._show(app));
            button.menu.addAction('Recolher para o painel', () => this._minimize(app));
            button.menu.addAction('Abrir nova janela', () => this._launch(app));
            button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            button.menu.addAction('Fechar janelas desta PWA', () => {
                for (const window of this._appWindows(app))
                    window.delete(global.get_current_time());
            });
            button.menu.addAction('Preferências…', () => this.openPreferences());
            // GNOME 50 uses ClickGesture, rather than button-press handlers.
            // Replace the default menu gesture through the public Actor API.
            button.clear_actions();
            const click = new Clutter.ClickGesture();
            click.set_recognize_on_press(true);
            click.connect('recognize', () => {
                if (click.get_button() === Clutter.BUTTON_PRIMARY) {
                    button.menu.close();
                    this._toggle(app);
                } else if (click.get_button() === Clutter.BUTTON_SECONDARY) {
                    button.menu.toggle();
                }
            });
            button.add_action(click);
            button.connect('key-press-event', (_actor, event) => {
                if ([Clutter.KEY_Return, Clutter.KEY_KP_Enter, Clutter.KEY_space,
                    Clutter.KEY_Down].includes(event.get_key_symbol())) {
                    button.menu.toggle();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });
            Main.panel.addToStatusArea(`${this.uuid}:${app.id}`, button, 0, 'right');
            this._buttons.set(app.id, button);
        }
        this._refresh();
    }

    _appWindows(app) {
        return [...this._windows.keys()].filter(window => {
            if (window.get_window_type() !== Meta.WindowType.NORMAL)
                return false;
            const trackedId = this._tracker.get_window_app(window)?.get_id();
            return matchApp(this._apps, trackedId, [window.get_wm_class(),
                window.get_wm_class_instance(), window.get_gtk_application_id()])?.id === app.id;
        });
    }

    _launch(app) {
        try {
            app.info.launch([], global.create_app_launch_context(0, -1));
        } catch (error) {
            Main.notifyError(`Não foi possível abrir ${app.name}`, error.message);
        }
    }

    _show(app) {
        const windows = this._appWindows(app);
        if (!windows.length) {
            this._launch(app);
            return;
        }
        for (const window of windows)
            window.unminimize();
        Main.activateWindow(windows.sort((a, b) => b.get_user_time() - a.get_user_time())[0]);
    }

    _minimize(app) {
        for (const window of this._appWindows(app)) {
            if (window.can_minimize())
                window.minimize();
        }
    }

    _toggle(app) {
        const windows = this._appWindows(app);
        if (windows.some(window => !window.minimized))
            this._minimize(app);
        else
            this._show(app);
    }

    _refresh() {
        for (const app of this._apps ?? []) {
            const button = this._buttons.get(app.id);
            if (!button)
                continue;
            const windows = this._appWindows(app);
            const state = !windows.length ? 'fechada' :
                windows.every(window => window.minimized) ? 'recolhida' : 'aberta';
            button.accessible_name = `${app.name} — ${state}. Clique para abrir ou recolher; botão direito para opções.`;
            button.opacity = windows.length ? 255 : 150;
            if (windows.some(window => window.demands_attention))
                button.add_style_pseudo_class('attention');
            else
                button.remove_style_pseudo_class('attention');
        }
    }

    disable() {
        if (this._reloadSource) {
            GLib.Source.remove(this._reloadSource);
            this._reloadSource = 0;
        }
        for (const [object, id] of this._signals)
            object.disconnect(id);
        for (const [window, ids] of this._windows) {
            for (const id of ids)
                window.disconnect(id);
        }
        this._windows.clear();
        for (const button of this._buttons.values())
            button.destroy();
        this._buttons.clear();
        this._apps = null;
        this._settings = null;
        this._monitor = null;
        this._tracker = null;
        this._signals = null;
    }
}
