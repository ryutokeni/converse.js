/* START: Removable components
 * --------------------
 * Any of the following components may be removed if they're not needed.
 */
import "converse-autocomplete";
import "converse-bookmarks";       // XEP-0048 Bookmarks
import "converse-caps";            // XEP-0115 Entity Capabilities
import "converse-chatview";        // Renders standalone chat boxes for single user chat
import "converse-controlbox";      // The control box
import "converse-dragresize";      // Allows chat boxes to be resized by dragging them
import "converse-embedded";
import "converse-fullscreen";
import "converse-push";            // XEP-0357 Push Notifications
import "converse-headline";        // Support for headline messages
import "@converse/headless/converse-mam";             // XEP-0313 Message Archive Management
import "converse-minimize";        // Allows chat boxes to be minimized
import "converse-muc-views";       // Views related to MUC
import "converse-notification";    // HTML5 Notifications
import "converse-omemo";
import "@converse/headless/converse-ping";            // XEP-0199 XMPP Ping
import "converse-register";        // XEP-0077 In-band registration
import "converse-roomslist";       // Show currently open chat rooms
import "converse-rosterview";
import "@converse/headless/converse-vcard";           // XEP-0054 VCard-temp
/* END: Removable components */

import converse from "@converse/headless/converse-core";

const WHITELISTED_PLUGINS = [
    'converse-autocomplete',
    'converse-bookmarks',
    'converse-caps',
    'converse-chatboxviews',
    'converse-chatview',
    'converse-controlbox',
    'converse-dragresize',
    'converse-embedded',
    'converse-fullscreen',
    'converse-headline',
    'converse-message-view',
    'converse-minimize',
    'converse-modal',
    'converse-muc-views',
    'converse-notification',
    'converse-oauth',
    'converse-omemo',
    'converse-profile',
    'converse-push',
    'converse-register',
    'converse-roomslist',
    'converse-rosterview',
    'converse-singleton'
];

const {
  initialize,
  updateContacts,
  updateGroups,
  updateMessageStatus,
  onLogOut,
  onLoadMessages,
  onOpenCreateGroupModal,
  createNewGroup,
  onLeaveGroup
} = converse;

converse.initialize = function (settings, callback) {
    if (converse.env._.isArray(settings.whitelisted_plugins)) {
        settings.whitelisted_plugins = settings.whitelisted_plugins.concat(WHITELISTED_PLUGINS);
    } else {
        settings.whitelisted_plugins = WHITELISTED_PLUGINS;
    }
    return initialize(settings, callback);
}

converse.updateContacts = function (contacts, group) {
    return updateContacts(contacts, group);
}
converse.updateGroups = function (groups) {
  return updateGroups(groups);
}
converse.updateMessageStatus = function (jid, messages) {
    return updateMessageStatus(jid, messages);
}

converse.onLogOut = function (callback) {
    return onLogOut(callback);
}

converse.onLoadMessages = function (callback) {
    return onLoadMessages(callback);
}

converse.onOpenCreateGroupModal = function (callback) {
    return onOpenCreateGroupModal(callback);
}

converse.createNewGroup = function (jid, attrs, participants) {
    return createNewGroup(jid, attrs, participants);
}

converse.onLeaveGroup = function (callback) {
    return onLeaveGroup(callback);
}

export default converse;
