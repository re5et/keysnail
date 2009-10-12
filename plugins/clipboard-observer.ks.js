var PLUGIN_INFO =
<KeySnailPlugin>
    <name>Clipboard observer</name>
    <name lang="ja">クリップボード監視君</name>
    <description>Observe clipboard</description>
    <description lang="ja">クリップボードを監視します</description>
    <version>1.0</version>
    <updateURL>http://github.com/mooz/keysnail/raw/master/plugins/clipboard-observer.js</updateURL>
    <iconURL>http://github.com/mooz/keysnail/raw/master/plugins/clipboard-observer.icon.png</iconURL>
    <author mail="stillpedant@gmail.com" homepage="http://d.hatena.ne.jp/mooz/">mooz</author>
    <license>The MIT License</license>
    <license lang="ja">MIT ライセンス</license>
    <minVersion>0.9.2</minVersion>
    <maxVersion>0.9.*</maxVersion>
    <provide>
        <ext>switch-clipboard-observer-status</ext>
    </provide>
    <detail><![CDATA[
=== 使い方 ===
このプラグインをインストールするとクリップボードの監視が始まり、コピーされたテキストの中身に URL があれば自動的に開かれるようになります。
    ]]></detail>
</KeySnailPlugin>;

var status = true;

function clipboardObserver(aText) {
    if (!status)
        return;

    var matched;

    while ((matched = aText.match("(h?t?tps?|ftp)(://[a-zA-Z0-9/?#_*.:/=&\\-]+)"))) {
        var prefix = (matched[1] == "ftp") ? "ftp" : "http";
        if (matched[1][matched[1].length - 1] == 's')
            prefix += "s";

        gBrowser.loadOneTab(prefix + matched[2], null, null, null, true);

        aText = aText.slice(aText.indexOf(matched[2]) + matched[2].length);
    }    
}

hook.addToHook('ClipboardChanged', clipboardObserver);

ext.add("switch-clipboard-observer-status", function () {
            status = !status;
            display.echoStatusBar("Clipboard observer " + (status ? "enabled" : "disabled"), 2000);
        }, "Switch clipboard observer status");