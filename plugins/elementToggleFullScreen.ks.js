var PLUGIN_INFO =
<KeySnailPlugin>
    <name>fullScreenElementToggle</name>
    <description>Allows you to toggle any element to fullscreen and back</description>
    <version>0.0.1</version>
    <updateURL>http://github.com/re5et/keysnail/raw/master/plugins/fullScreenElementToggle.ks.js</updateURL>
    <iconURL>http://github.com/re5et/keysnail/raw/master/plugins/icon/fullScreenElementToggle.icon.png</iconURL>
    <author mail="re5etsmyth@gmail.com" homepage="http://twitter.com/re5et">re5et</author>
    <license>The MIT License</license>
    <license lang="ja">MIT ライセンス</license>
    <minVersion>1.0</minVersion>
    <detail><![CDATA[
=== Description ===

==== toggles an element to fullscreen ====

By installing this plugin, you can create element fullscreen togglers in your .keysnail.js and bind them to a key to use.

For example the following snippet will allow you to toggle fullscreen the first textarea on a page:

>|javascript|
var toggleFullscreenOnFirstTextArea = new fullScreenElementToggle(document.querySelector('textarea:nth(1)'));

||<

]]></detail>
</KeySnailPlugin>;


var elementToggleFullScreen = function(element){
  this.full = false;
  this.toToggle = element;
  this.fullScreenStyles = {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 99999,
    width: '100%',
    height: '100%'
  };
  this.originalStyles = {};
}

elementToggleFullScreen.prototype.toggle = function(){
  console.log(this.full);
  if(this.full){
    for(prop in this.originalStyles){
      this.toToggle.style[prop] = this.originalStyles[prop];
    }
  }
  else{
    for(prop in this.fullScreenStyles){
      this.originalStyles[prop] = this.toToggle.style[prop];
      this.toToggle.style[prop] = this.fullScreenStyles[prop];
    }
  }
  this.full = this.full ? false : true;
}

// yToggler = new elementToggleFullScreen(document.querySelectorAll('img')[2]);
// myToggler.toggle();
