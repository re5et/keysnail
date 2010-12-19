/**
 * @fileOverview
 * @name keysnail.js
 * @author mooz <stillpedant@gmail.com>
 * @license The MIT License
 */

(function () {
    // modules
    let my, share, persist, util, display, command, html, hook, macro, style,
    key, prompt, ext, shell, userscript, completer, vimp, L, M, plugins;

    const { classes : Cc, interfaces : Ci } = Components;

    const logs = Cc["@mozilla.org/consoleservice;1"].getService(Ci.nsIConsoleService);

    const KeySnail = {
        modules: {},

        get windowType() {
            if (this._windowType)
                return this._windowType;

            return this._windowType = window.document.documentElement.getAttribute("windowtype");
        },

        get version() {
            return this.extInfo.version;
        },

        get id() {
            return "keysnail@mooz.github.com";
        },

        get isThunderbird() {
            return !!window.navigator.userAgent.match(/thunderbird/i);
        },

        init:
        function init() {
            if ("@mozilla.org/addons/integration;1" in Cc) // Over Gecko 2.0 or not
            {
                let am = {};
                Components.utils.import("resource://gre/modules/AddonManager.jsm", am);

                let self = this;
                am.AddonManager.getAddonByID(this.id, function (addon) {
                    self.extInfo = addon;
                    self.doInit();
                });
            }
            else
            {
                var extManager = Cc["@mozilla.org/extensions/manager;1"]
                    .createInstance(Ci.nsIExtensionManager);
                this.extInfo = extManager.getItemForID(this.id);
                this.doInit();
            }
        },

        doInit:
        function doInit() {
            // Arrange modules {{ ======================================================= //

            var moduleObjects = ["Util",
                                 "Display",
                                 "Command",
                                 "HTML",
                                 "Hook",
                                 "Macro",
                                 "Style",
                                 "Key",
                                 "Prompt",
                                 "Ext",
                                 "Shell",
                                 // UserScript must be the last
                                 "UserScript"];

            let modules = this.modules.modules = this.modules;

            // local namespace for user
            this.My = {};
            this.registerModule.call(this, "My");

            // global namespace for user
            try {
                Components.utils.import("resource://keysnail-share/share.js", modules);
            } catch (x) {}

            let self = this;
            moduleObjects.forEach(function (name) { self.registerModule(name); });
            moduleObjects.forEach(function (name) { self.initModule(name); });

            // set modules
            modules    = modules.modules;
            my         = modules.my;
            share      = modules.share;
            persist    = modules.persist;
            util       = modules.util;
            display    = modules.display;
            command    = modules.command;
            html       = modules.html;
            hook       = modules.hook;
            macro      = modules.macro;
            style      = modules.style;
            key        = modules.key;
            prompt     = modules.prompt;
            ext        = modules.ext;
            shell      = modules.shell;
            userscript = modules.userscript;
            completer  = modules.completer;
            vimp       = modules.vimp;
            L          = modules.L;
            M          = modules.M;
            plugins    = modules.plugins;

            // }} ======================================================================= //

            // now, run the keyhandler
            if (key.status && userscript.initFileLoaded)
                key.run();

            // main-window specific settings
            if (this.windowType === "navigator:browser") {
                this.settingsForBrowserWindow();
                key.updateStatusBar();
            }

            document.addEventListener("copy", function () { command.clipboardChanged(); }, true);
            hook.callHook("KeySnailInitialized");
        },

        /**
         * Register modules
         * add given module to KeySnail.modules
         * @param {[string]} aModuleName
         */
        registerModule: function (aModuleName) {
            // KeySnail.Key => modules.key
            // KeySnail.HTML => modules.html
            this.modules[aModuleName.toLowerCase()] = this[aModuleName];
            // this.modules.__defineGetter__(aModuleName.toLowerCase(), function () KeySnail[aModuleName]);
        },

        /**
         * Init modules
         * call each modules init() and add member 'modules' and 'parent'.
         * @param {[string]} aModuleName
         */
        initModule: function (aModuleName) {
            if (!this[aModuleName])
            {
                this.message('initModule: module "' + aModuleName + '" is not loaded. Skip this module.');
                return;
            }

            // add member "modules" to each module Object
            this[aModuleName].modules = this.modules;
            // add member "parent" to each module Object
            this[aModuleName].parent = this;
            // initialize module
            this[aModuleName].init();
            // this.message('initModule: module "' + aModuleName + '" initialized.');
        },

        /**
         * Create context menu
         */
        createInstallPluginMenu: function () {
            var modules = this.modules;

            function setMenuDisplay() {
                var item = document.getElementById("keysnail-plugin-installer");
                item.hidden = !gContextMenu.onLink || !gContextMenu.linkURL.match("\\.ks\\.js$");
            }

            function installPlugin() {
                var url = gContextMenu.linkURL;
                userscript.installPluginFromURL(url);
            }

            var contextMenu = document.getElementById("contentAreaContextMenu");
            var menuitem    = document.getElementById("keysnail-plugin-installer");

            menuitem = document.createElement("menuitem");
            menuitem.id = "keysnail-plugin-installer";
            menuitem.setAttribute("label", util.getLocaleString("installThisPlugin"));
            menuitem.setAttribute("accesskey", "k");
            menuitem.setAttribute("class", "menuitem-iconic");
            menuitem.setAttribute("src", "chrome://keysnail/skin/notify-icon16.png");
            contextMenu.appendChild(menuitem);

            menuitem.addEventListener("command", installPlugin, false);
            contextMenu.addEventListener("popupshowing", setMenuDisplay, false);
        },

        workAroundPopup: function () {
            with (KeySnail.modules)
            {
                const allowedEventsKey = "dom.popup_allowed_events";
                var allowedEvents = util.getUnicharPref(allowedEventsKey, "");
                var tmpAllowedEvents;

                if (allowedEvents.indexOf("keypress") === -1)
                {
                    tmpAllowedEvents = allowedEvents + " keypress";
                    util.setUnicharPref(allowedEventsKey, tmpAllowedEvents);

                    hook.addToHook("Unload", function () {
                        util.setUnicharPref(allowedEventsKey, allowedEvents);
                    });
                }
            }
        },

        settingsForBrowserWindow: function () {
            gBrowser.addProgressListener(KeySnail.urlBarListener,
                                         Ci.nsIWebProgress.NOTIFY_STATE_DOCUMENT);

            // add context menu
            this.createInstallPluginMenu();

            // start plugin's update checker
            this.startPluginUpdater();

            // hook window unload event
            window.addEventListener("unload", function () { KeySnail.Hook.callHook("Unload"); }, false);

            key.inExternalFile = true;
            hook.addToHook("Unload", function () { gBrowser.removeProgressListener(KeySnail.urlBarListener); });
            this.workAroundPopup();
            key.inExternalFile = false;

            // hook location bar copy / cut event
            try
            {
                let controller        = document.getElementById("urlbar")._copyCutController;
                let originalDoCommand = controller.doCommand;
                controller.doCommand = function (aCommand) {
                    originalDoCommand.apply(this, arguments);
                    command.clipboardChanged();
                };
            }
            catch (x)
            {
                this.message(x);
            }
        },

        startPluginUpdater: function () {
            if (!share.pluginUpdater)
                share.pluginUpdater = getPluginUpdater();

            if (share.pluginUpdater.shouldCheck)
                share.pluginUpdater.checkAndAlert();

            share.pluginUpdater.updateNotification();
        },

        openUpdatePluginDialog: function () {
            if (!share.pluginUpdater.hasUpdates)
                return;

            const windowType = 'KeySnail:Preference';

            const dialog = Cc['@mozilla.org/appshell/window-mediator;1']
                .getService(Ci.nsIWindowMediator)
                .getMostRecentWindow(windowType);

            if (dialog)
                dialog.focus();
            else
                window.openDialog("chrome://keysnail/content/update-plugin-dialog.xul",
                                  windowType,
                                  "chrome,titlebar,modal,dialog,centerscreen,resizable,scrollbars");
        },

        // updateNthPlugin: function (n) {
        //     let { path } = share.pluginUpdater.pluginsWithUpdate[n];

        //     share.pluginUpdater.updatePlugin(path, function (succeeded, script) {
        //         if (succeeded) {
        //             let info = script.info;
        //             alert(util.getLocaleString("pluginUpdated", [
        //                 util.xmlGetLocaleString(info.name),
        //                 util.xmlGetLocaleString(info.version)
        //             ]));
        //         } else {
        //             alert(util.getLocaleString("updaterStatusFailed"));
        //         }
        //     });
        // },

        // updateAllPlugins: function () {
        //     let status2string = {};
        //     status2string[share.pluginUpdater.STATUS.CHECKING]
        //         = util.getLocaleString("updaterStatusUpdating");
        //     status2string[share.pluginUpdater.STATUS.SUCCEEDED]
        //         = util.getLocaleString("updaterStatusUpdated");
        //     status2string[share.pluginUpdater.STATUS.FAILED]
        //         = util.getLocaleString("updaterStatusFailed");

        //     share.pluginUpdater.updateAllPlugins(
        //         function ({ current, total, status, script: { info } }) {
        //             display.echoStatusBar(
        //                 util.format("%s ... %s (%s / %s)",
        //                             util.xmlGetLocaleString(info.name),
        //                             status2string[status],
        //                             current, total)
        //             );
        //         }, function (succeeded) {
        //             if (succeeded)
        //                 alert(util.getLocaleString("updatedAllPlugins"));
        //             else
        //                 alert(util.getLocaleString("updaterStatusFailed"));
        //         }
        //     );
        // },

        /**
         * Open preference dialog
         */
        openPreference: function (aForce) {
            var openedWindow = Cc['@mozilla.org/appshell/window-mediator;1']
                .getService(Ci.nsIWindowMediator)
                .getMostRecentWindow('KeySnail:Preference');

            if (openedWindow && !aForce)
            {
                openedWindow.focus();
            }
            else
            {
                window.openDialog("chrome://keysnail/content/preference.xul",
                                  "Preferences",
                                  "chrome=yes,titlebar=yes,toolbar=yes,centerscreen=yes,resizable=yes,scrollbars=yes",
                                  "prefpane-rcfile");
            }
        },

        message: function (msg) {
            try {
                logs.logStringMessage(util.format.apply(null, arguments));
            } catch (x) {
                logs.logStringMessage("KeySnail.message :: " + x);
            }
        },

        /**
         * For checking the "LocationChange"
         */
        urlBarListener: {
            QueryInterface: function (aIID) {
                if (aIID.equals(Ci.nsIWebProgressListener) ||
                    aIID.equals(Ci.nsISupportsWeakReference) ||
                    aIID.equals(Ci.nsISupports))
                {
                    return KeySnail.urlBarListener;
                }
                throw Components.results.NS_NOINTERFACE;
            },

            onLocationChange: function (aProgress, aRequest, aURI) {
                KeySnail.Hook.callHook("LocationChange", aURI);
            },

            onStateChange: function () {},
            onProgressChange: function () {},
            onStatusChange: function () {},
            onSecurityChange: function () {},
            onLinkIconAvailable: function () {}
        }
    };

    function getPluginUpdater() {
        const pluginUpdater = {
            pluginsWithUpdate : [],

            eachNotificationElems: function (action) {
                util.getBrowserWindows().forEach(function ({ document : doc }) {
                    let notification = doc.getElementById("keysnail-plugin-notification");
                    let notifyIcon   = doc.getElementById("keysnail-plugin-update-notification-icon");
                    let checkingIcon = doc.getElementById("keysnail-plugin-update-checking-icon");
                    let checkingLabel = doc.getElementById("keysnail-plugin-update-checking-label");

                    action({
                        notification  : notification,
                        checkingIcon  : checkingIcon,
                        notifyIcon    : notifyIcon,
                        checkingLabel : checkingLabel
                    });
                });
            },

            get checkAutomatically() {
                return util.getBoolPref(
                    "extensions.keysnail.plugin.run_update_checker_automatically", true
                );
            },

            set checkAutomatically(v) {
                util.setBoolPref(
                    "extensions.keysnail.plugin.run_update_checker_automatically", v
                );
            },

            _checking : false,
            get checking() pluginUpdater._checking,
            set checking(isChecking) {
                pluginUpdater._checking = isChecking;

                pluginUpdater.eachNotificationElems(function ({
                    notification, checkingIcon, checkingLabel, notifyIcon
                }) {
                    if (isChecking) {
                        notifyIcon.hidden    = true;
                        checkingIcon.hidden  = false;
                        checkingLabel.hidden = false;
                        notification.hidden  = false;
                    } else {
                        notifyIcon.hidden    = true;
                        checkingIcon.hidden  = true;
                        checkingLabel.hidden = true;
                        notification.hidden  = true;
                    }
                });
            },

            get hasUpdates() {
                return pluginUpdater.pluginsWithUpdate
                    && pluginUpdater.pluginsWithUpdate.length > 0;
            },

            set notificationVisible(visible) {
                let count = pluginUpdater.pluginsWithUpdate.length;

                let tooltipText = count > 0 ?
                    util.getLocaleString("updaterUpdatesFound", [count]) :
                    util.getLocaleString("updaterNoUpdatesFound");

                pluginUpdater.eachNotificationElems(function ({
                    notification, notifyIcon
                }) {
                    notification.hidden = !visible;
                    notifyIcon.hidden   = !visible;

                    if (visible)
                        notification.setAttribute("tooltiptext", tooltipText);
                });
            },

            updateNotification: function () {
                pluginUpdater.notificationVisible = pluginUpdater.hasUpdates;
            },

            get lastUpdate() {
                let time = parseInt(util.getUnicharPref(
                    "extensions.keysnail.plugin.last_update", "0"
                ), 10);

                return isNaN(time) ? 0 : time;
            },

            set lastUpdate(v) {
                util.setUnicharPref(
                    "extensions.keysnail.plugin.last_update", v.toString()
                );
            },

            setLastUpdateTimeStamp: function () {
                // util.message("keysnail :: Update last update timestamp");
                pluginUpdater.lastUpdate = Date.now();
            },

            get elapsedHours() {
                return (Date.now() - pluginUpdater.lastUpdate) / (1000 * 60 * 60);
            },

            get shouldCheck() {
                // TODO: Make this interval customizable
                let interval = 24; // 24 hour.

                return this.elapsedHours >= interval
                    && !pluginUpdater.pluginsWithUpdate.length
                    && !pluginUpdater.checking
                    && pluginUpdater.checkAutomatically;
            },

            check: function (next) {
                // avoid confliction
                if (pluginUpdater.checking)
                    return;

                let paths = [path for ([path, plugin] in Iterator(plugins.context))];

                pluginUpdater.checking = true;
                pluginUpdater.pluginsWithUpdate = [];

                const total = paths.length;

                function updateStatus(path) {
                    let current     = total - paths.length;
                    let name        = util.getLeafNameFromURL(util.pathToURL(path));
                    let countText   = util.format("(%s / %s)", current, total);
                    let tooltipText = util.getLocaleString("checkingPluginUpdate", [name])
                        + " " + countText;

                    pluginUpdater.eachNotificationElems(function ({
                        notification, checkingIcon, checkingLabel
                    }) {
                        checkingIcon.hidden  = false;
                        checkingLabel.hidden = false;
                        notification.hidden  = false;
                        notification.setAttribute("tooltiptext", tooltipText);
                        checkingLabel.setAttribute("value", countText);
                    });
                }

                (function checkNext() {
                    if (!paths.length) {
                        // finish
                        pluginUpdater.checking = false;
                        pluginUpdater.updateNotification();
                        if (!pluginUpdater.hasUpdates)
                            pluginUpdater.setLastUpdateTimeStamp();
                        if (typeof next === "function")
                            next(pluginUpdater.hasUpdates);
                        return;
                    }

                    let path = paths.pop();

                    updateStatus(path);

                    // util.message("--------------------------------------------------");
                    // util.message("Checking " + path + " ... ");
                    userscript.doesPluginHasUpdate(path, function (hasUpdate, context) {
                        if (hasUpdate) {
                            context.path = path;
                            pluginUpdater.pluginsWithUpdate.push(context);
                            // util.message("=> has update");
                        }
                        return checkNext();
                    });
                })();
            },

            checkAndAlert: function () {
                pluginUpdater.check(function (hasUpdate) {
                    if (hasUpdate) {
                        let count = share.pluginUpdater.pluginsWithUpdate.length;

                        display.showPopup(
                            util.getLocaleString("keySnailPlugin"),
                            util.getLocaleString("updaterUpdatesFound", [count]), {
                                icon      : "chrome://keysnail/skin/icon/update-notification-large.png",
                                cookie    : true,
                                clickable : true,
                                observer  : {
                                    observe : function (subject, topic, data) {
                                        if (topic !== "alertclickcallback")
                                            return;

                                        const win = Cc["@mozilla.org/appshell/window-mediator;1"]
                                            .getService(Ci.nsIWindowMediator)
                                            .getMostRecentWindow("navigator:browser");

                                        win.KeySnail.openUpdatePluginDialog();
                                    }
                                }
                            }
                        );
                    }
                });
            },

            installScript: function (script, next) {
                userscript.installPluginAndRequiredFiles({
                    name           : util.getLeafNameFromURL(util.pathToURL(script.path)),
                    code           : script.code,
                    info           : script.info,
                    forceOverWrite : true,
                    next           : function (succeeded) {
                        if (typeof next === "function")
                            next(succeeded);
                    }
                });
            },

            updatePlugin: function (path, next) {
                if (!pluginUpdater.hasUpdates)
                    return;

                let script = util.find(pluginUpdater.pluginsWithUpdate,
                                       function ({ path : p }) path === p);

                pluginUpdater.installScript(script, function (succeeded) {
                    if (succeeded) {
                        // remove script
                        pluginUpdater.pluginsWithUpdate.splice(
                            pluginUpdater.pluginsWithUpdate.indexOf(script), 1
                        );
                    }

                    if (!pluginUpdater.hasUpdates)
                        pluginUpdater.setLastUpdateTimeStamp();

                    pluginUpdater.updateNotification();

                    if (typeof next === "function")
                        next(succeeded, script);
                });
            },

            updatePlugins: function (paths, next) {
                if (!pluginUpdater.hasUpdates)
                    return;

                (function updateNext() {
                    if (!paths.length) {
                        if (!pluginUpdater.hasUpdates)
                            pluginUpdater.setLastUpdateTimeStamp();

                        pluginUpdater.updateNotification();

                        if (typeof next === "function")
                            next(true);

                        return;
                    }

                    let path   = paths.pop();
                    let script = util.find(pluginUpdater.pluginsWithUpdate,
                                           function ({ path : p }) path === p);

                    if (!script)
                        updateNext();

                    pluginUpdater.installScript(script, function (succeeded) {
                        if (succeeded)
                            pluginUpdater.pluginsWithUpdate.splice(
                                pluginUpdater.pluginsWithUpdate.indexOf(script), 1
                            );

                        updateNext();
                    });
                })();
            },

            STATUS: {
                CHECKING  : 0,
                SUCCEEDED : 1,
                FAILED    : 2
            },

            updateAllPlugins: function (listener, next) {
                if (!pluginUpdater.hasUpdates)
                    return;

                let scripts = pluginUpdater.pluginsWithUpdate;
                let failed  = [];

                const total = scripts.length;

                function callProgressListener(script, status) {
                    if (typeof listener !== "function")
                        return;

                    listener({
                        current : total - scripts.length,
                        total   : total,
                        status  : status,
                        script  : script
                    });
                }

                (function updateNext() {
                    if (!scripts.length) {
                        pluginUpdater.pluginsWithUpdate = failed;

                        if (!pluginUpdater.hasUpdates)
                            pluginUpdater.setLastUpdateTimeStamp();

                        pluginUpdater.updateNotification();

                        if (typeof next === "function")
                            next(true);

                        return;
                    }

                    let script = scripts.pop();

                    callProgressListener(script, pluginUpdater.STATUS.CHECKING);

                    pluginUpdater.installScript(script, function (succeeded) {
                        if (!succeeded)
                            failed.push(script);

                        callProgressListener(
                            script,
                            pluginUpdater.STATUS[succeeded ? "SUCCEEDED" : "FAILED"]
                        );

                        updateNext();
                    });
                })();
            }
        };

        return pluginUpdater;
    }

    window.KeySnail = KeySnail;
})();
