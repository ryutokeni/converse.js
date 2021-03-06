// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

/* This is a Converse.js plugin which add support for application-level pings
 * as specified in XEP-0199 XMPP Ping.
 */

import "strophejs-plugin-ping";
import converse from "./converse-core";

// Strophe methods for building stanzas
const { Strophe, _ } = converse.env;

converse.plugins.add('converse-ping', {

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this;

        _converse.api.settings.update({
            ping_interval: 180 //in seconds
        });

        _converse.ping = function (jid, success, error, timeout) {
            // XXX: We could first check here if the server advertised that
            // it supports PING.
            // However, some servers don't advertise while still keeping the
            // connection option due to pings.
            //
            // var feature = _converse.disco_entities[_converse.domain].features.findWhere({'var': Strophe.NS.PING});
            _converse.lastStanzaDate = new Date();
            if (_.isNil(jid)) {
                jid = Strophe.getDomainFromJid(_converse.bare_jid);
            }
            if (_.isUndefined(timeout) ) { timeout = null; }
            if (_.isUndefined(success) ) { success = null; }
            if (_.isUndefined(error) ) { error = null; }
            if (_converse.connection) {
                _converse.connection.ping.ping(jid, success, error, timeout);
                return true;
            }
            return false;
        };

        _converse.pong = function (ping) {
            if (ping.getAttribute('CustomType') === 'VerificationRequest') {
              const verification = ping.querySelector('VerificationRequest');
              _converse.emit('StatusMedicalRequestChanged', verification.getAttribute('key'));
              let chatboxId = verification.getAttribute('sender');
              if (chatboxId === Strophe.getNodeFromJid(_converse.bare_jid)) {
                chatboxId = verification.getAttribute('recipient');
              }
              chatboxId = `${chatboxId}${_converse.user_settings.domain}`
              converse.updateMessage(
                chatboxId,
                { medialRequestKey: verification.getAttribute('key') },
                {
                  medReqStt: verification.getAttribute('status'),
                  subject: verification.getAttribute('subject'),
                  description: verification.getAttribute('description'),
                  senderSignedMedReq: !!verification.getAttribute('senderSignatureUrl'),
                  rcvrSignedMedReq: !!verification.getAttribute('recipientSignatureUrl')
                }
              )
            }
            else {
                if (ping.getAttribute('customType') === 'get-status') {
                //    if (_converse.user_settings.imported_contacts || _converse.user_settings.my_organization) {
                //     //some thing can handdle now
                //    }
                //    else {
                    _converse.emit('StatusChatChanged', {
                        'status': ping.children[0].getAttribute('value') === 'Busy' ? 'BUSY' : 
                        (ping.children[0].getAttribute('value') === 'OnCall' ? 'ON_CALL': 'OFF_CALL'),
                        'user': ping.getAttribute('username')
                    } )
                    // _converse.user_settings.imported_contacts = _converse.user_settings.imported_contacts.map(e => {
                    //     if (e.get())
                    //     return e;
                    // })
                }
            }
            _converse.lastStanzaDate = new Date();
            _converse.connection.ping.pong(ping);
            return true;
        };

        _converse.registerPongHandler = function () {
            if (!_.isUndefined(_converse.connection.disco)) {
                _converse.api.disco.own.features.add(Strophe.NS.PING);
            }
            _converse.connection.ping.addPingHandler(_converse.pong);
        };

        _converse.registerPingHandler = function () {
            _converse.registerPongHandler();
            if (_converse.ping_interval > 0) {
                _converse.connection.addHandler(function () {
                    /* Handler on each stanza, saves the received date
                     * in order to ping only when needed.
                     */
                    _converse.lastStanzaDate = new Date();
                    return true;
                });
                _converse.connection.addTimedHandler(1000, function () {
                    const now = new Date();
                    if (!_converse.lastStanzaDate) {
                        _converse.lastStanzaDate = now;
                    }
                    if ((now - _converse.lastStanzaDate)/1000 > _converse.ping_interval) {
                        return _converse.ping();
                    }
                    return true;
                });
            }
        };

        const onConnected = function () {
            // Wrapper so that we can spy on registerPingHandler in tests
            _converse.registerPingHandler();
        };
        _converse.on('connected', onConnected);
        _converse.on('reconnected', onConnected);
    }
});
