// Converse.js
// http://conversejs.org
//
// Copyright (c) 2012-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

import "@converse/headless/converse-chatboxes";
import "backbone.nativeview";
import "backbone.overview";
import tpl_recent_messages from "templates/recent_messages.html";
import tpl_recent_messages_item from "templates/recent_messages_item.html";
import converse from "@converse/headless/converse-core";

const { Backbone, _, utils } = converse.env;
const u = utils;

converse.plugins.add('pageme-recent-messages-view', {
    dependencies: ["converse-chatboxes"],
    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this,
              { __ } = _converse;

        _converse.api.promises.add([
            'recentMessageViewsInitialized'
        ]);

        _converse.RecentMessagesView = Backbone.NativeView.extend({
            tagName: 'li',
            className: 'list-item d-flex controlbox-padded',
            initialize () {
                this.model.on('change', this.render, this);
                this.model.on('change:latestMessageTime', this.showOrHide, this);
                this.model.on("highlight", this.highlight, this);
                this.model.on('addToRecent', this.show, this);
                this.model.on('hideFromRecent', this.hide, this);
                if (this.tryToGetDisplayName()) {

                } else {
                  _converse.on('load-done', (labelName) => {
                    if (this.model.get('name')) {
                      return;
                    }
                    if (labelName === 'My Organization') {
                      this.model.set('name', this.getDisplayName(_converse.user_settings.my_organization));
                    } else {
                      this.model.set('name', this.getDisplayName(_converse.user_settings.imported_contacts));
                    }
                  })
                }
            },

            render () {
                this.el.innerHTML = tpl_recent_messages_item(
                  _.extend(this.model.toJSON(), this.getConfig())
                );
                return this;
            },

            tryToGetDisplayName () {
              const contacts = (_converse.user_settings.my_organization || []).concat(_converse.user_settings.imported_contacts || []);
              const name = this.getDisplayName(contacts);
              this.model.set('name', name);
              return !!name;
            },

            showOrHide () {
              const jid = this.model.get('jid');
              if (jid && jid !== _converse.bare_jid) {
                if (this.model.get('latestMessageTime')) {
                  this.show();
                  return;
                }
              }
              this.hide();
            },

            getConfig () {
              const isChatroom =  this.model.get('type') === 'chatroom';
              return {
                  name: isChatroom ? (this.model.get('subject') || {}).text : this.model.get('name'),
                  status_icon: isChatroom ? 'open-room' : 'open-single'
              };
            },

            hide () {
                u.hideElement(this.el);
            },

            show () {
                u.fadeIn(this.el);

            },

            highlight () {
                if (_converse.isSingleton()) {
                    const chatbox = _converse.chatboxes.get(this.model.get('jid'));
                    if (chatbox) {
                        if (chatbox.get('hidden')) {
                            this.el.classList.remove('open');
                        } else {
                            this.el.classList.add('open');
                        }
                    }
                }
            },

            getDisplayName(contacts) {
              const jid = this.model.get('jid');
              const foundContact = _.find(contacts, contact => {
                if (!contact.userName) {
                  return false;
                }
                return (jid === contact.userName +  _converse.user_settings.domain);
              });
              return (foundContact || {}).fullName;
            },
        });

        _converse.RecentMessagesViews = Backbone.OrderedListView.extend({
            tagName: 'div',
            id: 'recent-messages',
            className: 'controlbox-section',

            ItemView: _converse.RecentMessagesView,
            listItems: 'model',
            listSelector: '.recent-messages',
            sortEvent: null, // Groups are immutable, so they don't get re-sorted

            events: {
                'click .cbox-list-item': 'openChatbox'
            },

            initialize () {
                Backbone.OrderedListView.prototype.initialize.apply(this, arguments);
                this.model.on('add', this.showOrHide, this);
                this.sortAndPositionAllItems.bind(this);
            },

            openChatbox (ev) {
                ev.preventDefault();
                const name = ev.target.textContent;
                const jid = ev.target.getAttribute('data-jid');
                const data = {
                    'name': name || Strophe.unescapeNode(Strophe.getNodeFromJid(jid)) || jid
                }
                _converse.api.chats.open(jid, data);
            },

            showOrHide (item) {
              const jid = item.get('jid');
              if (jid && jid !== _converse.bare_jid) {
                if (item.get('latestMessageTime')) {
                  item.trigger('addToRecent');
                  return;
                }
              }
              item.trigger('hideFromRecent');
            },

            render () {
                this.el.innerHTML = tpl_recent_messages({});
                _converse.emit('recentMessageViewsInitialized');
                return this;
            },
        });


        /************************ BEGIN Event Handlers ************************/
        _converse.api.listen.on('chatBoxesInitialized', () => {
            if (_converse.authentication === _converse.ANONYMOUS) {
                return;
            }
            _converse.recentMessagesViews = new _converse.RecentMessagesViews({
                'model': _converse.chatboxes
            });
            _converse.chatboxes.on('change:hidden', (chatbox) => {
                const contact = _converse.roster.findWhere({'jid': chatbox.get('jid')});
                chatbox.trigger('highlight');
            });
            _converse.recentMessagesViews.render();
        });
    }
});
