"use strict";

class ConsolidatedTranslucencyEffect {
    constructor() {
        this.cfg = {};

        effect.configChanged.connect(this.loadConfig.bind(this));
        effects.windowAdded.connect((win) => {
            this.manage(win);
            this.applyOpacity(win);
        });
        effects.windowClosed.connect(this.cancelOpacity.bind(this));
        effects.windowActivated.connect(this.onActivated.bind(this));

        for (const win of effects.stackingOrder) {
            this.manage(win);
        }

        this.loadConfig();
    }

    loadConfig() {
        const r = (k, d) => effect.readConfig(k, d);
        this.cfg = {
            GlobalActive:   r("GlobalActive", 97) / 100,
            GlobalInactive: r("GlobalInactive", 87) / 100,

            Fullscreen: {
                enabled:  r("FullscreenEnabled", true),
                override: r("FullscreenOverride", false),
                active:   r("FullscreenActive", 100) / 100,
                inactive: r("FullscreenInactive", 100) / 100,
            },
            Dialogs: {
                enabled:  r("DialogsEnabled", true),
                override: r("DialogsOverride", false),
                active:   r("DialogsActive", 97) / 100,
                inactive: r("DialogsInactive", 87) / 100,
            },
            Menus: {
                enabled:  r("MenusEnabled", false),
                override: r("MenusOverride", false),
                active:   r("MenusActive", 97) / 100,
                inactive: r("MenusInactive", 87) / 100,
            },
            Notifications: {
                enabled:  r("NotificationsEnabled", false),
                override: r("NotificationsOverride", false),
                active:   r("NotificationsActive", 97) / 100,
                inactive: r("NotificationsInactive", 87) / 100,
            },
            MoveResize: {
                enabled:  r("MoveResizeEnabled", true),
                override: r("MoveResizeOverride", false),
                opacity:  r("MoveResizeOpacity", 80) / 100,
            },
            Dock: {
                enabled:  r("DockEnabled", false),
                override: r("DockOverride", false),
                active:   r("DockActive", 97) / 100,
                inactive: r("DockInactive", 87) / 100,
            },
            Desktop: {
                enabled:  r("DesktopEnabled", false),
                override: r("DesktopOverride", false),
                active:   r("DesktopActive", 97) / 100,
                inactive: r("DesktopInactive", 87) / 100,
            },
            Unmanaged: {
                enabled:  r("UnmanagedEnabled", false),
                override: r("UnmanagedOverride", false),
                active:   r("UnmanagedActive", 97) / 100,
                inactive: r("UnmanagedInactive", 87) / 100,
            },

            ExemptList: r("ExemptList", "")
                .split("\n")
                .map(s => s.trim())
                .filter(s => s.length > 0)
                .map(s => new RegExp("^" + s + "$")),
        };

        for (const win of effects.stackingOrder) {
            this.cancelOpacity(win);
            this.applyOpacity(win);
        }
    }

    getOpacity(win, isActive) {
        const c = this.cfg;
        if (win.fullScreen) {
            if (!c.Fullscreen.enabled) return null;
            return c.Fullscreen.override
                ? (isActive ? c.Fullscreen.active : c.Fullscreen.inactive)
                : (isActive ? c.GlobalActive : c.GlobalInactive);
        }
        if (win.dialog || win.modal) {
            if (!c.Dialogs.enabled) return null;
            return c.Dialogs.override
                ? (isActive ? c.Dialogs.active : c.Dialogs.inactive)
                : (isActive ? c.GlobalActive : c.GlobalInactive);
        }
        if (win.dropdownMenu || win.popupMenu || win.comboBox || win.menu) {
            if (!c.Menus.enabled) return null;
            return c.Menus.override
                ? (isActive ? c.Menus.active : c.Menus.inactive)
                : (isActive ? c.GlobalActive : c.GlobalInactive);
        }
        if (win.notification || win.criticalNotification || win.onScreenDisplay) {
            if (!c.Notifications.enabled) return null;
            return c.Notifications.override
                ? (isActive ? c.Notifications.active : c.Notifications.inactive)
                : (isActive ? c.GlobalActive : c.GlobalInactive);
        }
        if (win.dock) {
            if (!c.Dock.enabled) return null;
            return c.Dock.override
                ? (isActive ? c.Dock.active : c.Dock.inactive)
                : (isActive ? c.GlobalActive : c.GlobalInactive);
        }
        if (win.desktopWindow) {
            if (!c.Desktop.enabled) return null;
            return c.Desktop.override
                ? (isActive ? c.Desktop.active : c.Desktop.inactive)
                : (isActive ? c.GlobalActive : c.GlobalInactive);
        }
        if (win.windowType === -1) {
            if (!c.Unmanaged.enabled) return null;
            return c.Unmanaged.override
                ? (isActive ? c.Unmanaged.active : c.Unmanaged.inactive)
                : (isActive ? c.GlobalActive : c.GlobalInactive);
        }

        // normal window
        return isActive ? c.GlobalActive : c.GlobalInactive;
    }

    isExempt(win) {
        const parts = win.windowClass.split(" ");
        return this.cfg.ExemptList.some(r => parts.some(p => r.test(p)));
    }

    cancelOpacity(win) {
        if (win.cteOpacityId !== undefined) {
            cancel(win.cteOpacityId);
            win.cteOpacityId = undefined;
        }
    }

    applyOpacity(win) {
        if (!win.visible || win.deleted || win.minimized) return;
        if (this.isExempt(win)) {
            this.cancelOpacity(win);
            return;
        }

        const isActive = win === effects.activeWindow;
        const target = this.getOpacity(win, isActive);

        if (target === null) {
            this.cancelOpacity(win);
            return;
        }

        this.cancelOpacity(win);
        win.cteOpacityId = set({
            window: win,
            duration: 0,
            animations: [{
                type: Effect.Opacity,
                from: target,
                to: target
            }]
        });
    }

    onActivated(win) {
        for (const w of effects.stackingOrder) {
            this.applyOpacity(w);
        }
    }

    manage(win) {
        if (win.cteManaged) return;
        win.cteManaged = true;

        win.minimizedChanged.connect(() => {
            if (win.minimized) {
                this.cancelOpacity(win);
            } else {
                this.applyOpacity(win);
            }
        });
        win.windowFullScreenChanged.connect(() => this.applyOpacity(win));
        win.windowStartUserMovedResized.connect(() => this.onMoveResizeStart(win));
        win.windowFinishUserMovedResized.connect(() => this.onMoveResizeFinish(win));
    }

    onMoveResizeStart(win) {
        const c = this.cfg.MoveResize;
        if (!c.enabled || this.isExempt(win)) return;
        const opacity = c.override ? c.opacity : this.cfg.GlobalInactive;
        this.cancelOpacity(win);
        win.cteOpacityId = set({
            window: win,
            duration: animationTime(250),
            animations: [{ type: Effect.Opacity, to: opacity }]
        });
    }

    onMoveResizeFinish(win) {
        this.cancelOpacity(win);
        this.applyOpacity(win);
    }
}

new ConsolidatedTranslucencyEffect();
