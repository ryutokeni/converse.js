// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2018, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

import converse from  "@converse/headless/converse-core";
import filesize from "filesize";
import html from "./utils/html";
import tpl_csn from "templates/csn.html";
import tpl_file_progress from "templates/file_progress.html";
import tpl_info from "templates/info.html";
import tpl_message from "templates/message.html";
import tpl_message_versions_modal from "templates/message_versions_modal.html";
import u from "@converse/headless/utils/emoji";
import xss from "xss";
const {
  Backbone,
  Strophe,
  _,
  moment,
  b64_sha1,
} = converse.env;
const medReqLabel = {
  wait4Appro: 'Waiting for Approval',
  wait4UrAppro: 'Waiting for Your Approval',
  approved: 'Approved',
  deleted: 'Deleted',
  expired: 'Period expired'
};

converse.plugins.add('converse-message-view', {

    dependencies: ["converse-modal"],

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this,
            { __ } = _converse;


        _converse.api.settings.update({
            'show_images_inline': true
        });

        _converse.api.promises.add([
            'rerenderMessage',
            'message-rendered'
        ]);

        _converse.MessageVersionsModal = _converse.BootstrapModal.extend({
            toHTML () {
                return tpl_message_versions_modal(_.extend(
                    this.model.toJSON(), {
                    '__': __
                }));
            }
        });

        _converse.MessageCountDown = Backbone.Model.extend({
          msgid: null,
          expiration: null,
          time_remain: null,
          defaults () {
              return {
                  'id': _converse.connection.getUniqueId(),
                  'url': ''
              };
          }
        });

        _converse.MessageCountDownView = Backbone.VDOMView.extend({
          tagName: 'span',
          defaults () {
              return {
                  'id': _converse.connection.getUniqueId()
              };
          },
          initialize () {
            this.model.on('change:time_remain', this.render, this);
            setInterval(() => {
              this.model.set('time_remain',  this.model.get('expiration') - (new Date()).getTime())
            }, 1000);
          },
          render () {
            const tempTime = moment.duration(this.model.get('time_remain'));
            const timeStr = tempTime.hours() + ":" + tempTime.minutes() + ":" + tempTime.seconds();
            this.el.innerHTML = timeStr;
            return this.el;
          }
        })


        _converse.MessageView = _converse.ViewWithAvatar.extend({
            countDown: _converse.MessageCountDownView,
            events: {
                'click .chat-msg__edit-modal': 'showMessageVersionsModal',
                'click .pageme-media': 'showPageMeMediaViewer',
                'click .pageme-medical-request': 'showPageMeMedicalRequest',
                'click .download-image': 'showConfirmDownloadImage'
            },

            defaults () {
                return {
                    'id': _converse.connection.getUniqueId(),
                    'url': ''
                };
            },

            initialize () {
                const countDownModel = new _converse.MessageCountDown({
                  msgid: this.model.get('msgid'),
                  expiration: new Date(this.model.get('time')).getTime() + parseInt(this.model.get('time_to_read')) * 1000
                });
                this.countDown = new _converse.MessageCountDownView({'model': countDownModel});
                if (this.model.vcard) {
                    this.model.vcard.on('change', this.render, this);
                }
                this.model.on('change', this.onChanged, this);
                this.model.on('destroy', this.remove, this);
                this.model.on('change:senderName', this.render, this);
                this.model.on('change:senderFullName', this.render, this)
                _converse.on('rerenderMessage', this.render, this);
            
                _converse.on('updateProfile', data => {
                    if (this.model.get('sender') === 'me') {
                        this.image = data.avatarUrl;
                        this.model.get('type') === 'groupchat' ? this.model.set('senderName', data.fullName) : this.model.set('senderFullName', data.fullName);
                    // this.renderAvatar(msg);
                    }
                })
            },

            async render (force) {
                if (this.rendered && !force) {
                  return;
                }
                const is_followup = u.hasClass('chat-msg--followup', this.el);
                if (this.model.isOnlyChatStateNotification()) {
                    this.renderChatStateNotification()
                } else if (this.model.get('file') && !this.model.get('oob_url')) {
                    if (!this.model.file) {
                        _converse.log("Attempted to render a file upload message with no file data");
                        return this.el;
                    }
                    this.renderFileUploadProgresBar();
                } else if (this.model.get('type') === 'error') {
                    this.renderErrorMessage();
                } else {
                    await this.renderChatMessage();
                }
                if (is_followup) {
                    u.addClass('chat-msg--followup', this.el);
                }
                var countDownEl = this.el.querySelector('.chat-msg__count_down');
                if (countDownEl) {
                    countDownEl.replaceWith(this.countDown.render());
                }
                return this.el;
            },

            async onChanged (item) {
                // Jot down whether it was edited because the `changed`
                // attr gets removed when this.render() gets called further
                // down.
                const edited = item.changed.edited;
                if (this.model.changed.progress) {
                    return this.renderFileUploadProgresBar();
                }
                if (_.filter(['correcting', 'message', 'type', 'upload', 'received', 'sent', 'loaded'],
                             prop => Object.prototype.hasOwnProperty.call(this.model.changed, prop)).length) {
                    await this.render(true);
                }
                if (edited) {
                    this.onMessageEdited();
                }
            },

            onMessageEdited () {
                if (this.model.get('is_archived')) {
                    return;
                }
                this.el.addEventListener('animationend', () => u.removeClass('onload', this.el));
                u.addClass('onload', this.el);
            },

            replaceElement (msg) {
                if (!_.isNil(this.el.parentElement)) {
                    this.el.parentElement.replaceChild(msg, this.el);
                }
                this.setElement(msg);
                return this.el;
            },

            findPagemeMessage() {
                const pagemeMessage = _.find(_converse.pagemeMessages || [], msg => (msg.stanza.id === this.model.get('msgid')));
                if (pagemeMessage) {
                  return pagemeMessage.decrypted;
                } else {
                  return null;
                }
            },

            async renderChatMessage () {
                const is_me_message = this.isMeCommand(),
                      moment_time = moment(this.model.get('time')),
                      role = this.model.vcard ? this.model.vcard.get('role') : null,
                      roles = role ? role.split(',') : [];


                if (this.model.get('time_to_read')) {
                  if (this.model.get('time')) {
                    const expiration = new Date(this.model.get('time')).getTime() + parseInt(this.model.get('time_to_read')) * 1000;
                    if (expiration - (new Date()).getTime() <= 0) {
                      if (this.model) {
                        this.model.destroy();
                      }
                      return;
                    }
                  }
                } else {
                  this.model.destroy();
                  return;
                }
                const mediaId = this.model.get('mediaId');
                const medialRequestKey = this.model.get('medialRequestKey');
                let text = this.findPagemeMessage();
                const msg = u.stringToElement(tpl_message(
                    _.extend(
                        this.model.toJSON(), {
                        '__': __,
                        'is_encrypted': text ? true : false,
                        'is_me_message': is_me_message,
                        'roles': roles,
                        'pretty_time': moment_time.format(_converse.time_format),
                        'time': moment_time.format(),
                        'extra_classes': this.getExtraMessageClasses(),
                        'label_show': __('Show more'),
                        'username': this.model.getDisplayName()
                    })
                ));
                if (mediaId) {
                    if (localStorage.getItem('isOrganizationJoined') === 'true' || localStorage.getItem('isPurchasedMedicalRequest') === 'true') {
                        msg.querySelector('.chat-msg__media').innerHTML = _.flow(
                        _.partial(u.renderPageMeMedia, _converse, this.model.get('itemType'), this.model.get('sender'), true),
                        )(mediaId);
                    }else {
                         msg.querySelector('.chat-msg__media').innerHTML = _.flow(
                        _.partial(u.renderPageMeMedia, _converse, this.model.get('itemType'), this.model.get('sender'), false),
                        )(mediaId);
                    }

                }
                if (medialRequestKey) {
                    msg.querySelector('.chat-msg__medical_request').innerHTML = _.flow(
                      _.partial(u.renderPageMeMedicalReq, _converse)
                    )(medialRequestKey);
                    const status = this.model.get('medReqStt');
                    text = this.renderMedicalRequestStatus(status);
                }
                const url = this.model.get('oob_url');
                if (url) {
                    msg.querySelector('.chat-msg__media').innerHTML = _.flow(
                        _.partial(u.renderFileURL, _converse),
                        _.partial(u.renderMovieURL, _converse),
                        _.partial(u.renderAudioURL, _converse),
                        _.partial(u.renderImageURL, _converse))(url);
                }
                if (text || mediaId || medialRequestKey) {
                  if (!medialRequestKey) {
                    this.rendered = true;
                  }
                  const is_hidden = u.hasClass('hidden', msg);
                  if (is_hidden) {
                    u.removeClass('hidden', msg);
                  }
                } else {
                  u.addClass('hidden', msg);
                }
                const msg_content = msg.querySelector('.chat-msg__text');
                if (text && text !== url && text !== mediaId) {
                    if (is_me_message) {
                        text = text.substring(4);
                    }
                    text = xss.filterXSS(text, {'whiteList': {}});
                    msg_content.innerHTML = _.flow(
                        _.partial(u.geoUriToHttp, _, _converse.geouri_replacement),
                        _.partial(u.addMentionsMarkup, _, this.model.get('references'), this.model.collection.chatbox),
                        u.addHyperlinks,
                        u.renderNewLines,
                        _.partial(u.addEmoji, _converse, _)
                    )(text);
                }
                if (text !== null) {
                    _converse.emit('message-rendered')
                }

                const promise = u.renderImageURLs(_converse, msg_content);

                if (this.model.get('type') !== 'headline') {
                    const jid = Strophe.getNodeFromJid(_converse.bare_jid);
                    if (!this.image || this.image.includes('/null')){
                        this.image = `${_converse.user_settings.avatarUrl}${jid}`;
                    }
                    this.width = this.height = 60;
                    if (this.model.get('sender') === 'them') {
                        if (this.model.get('type') === 'groupchat') {

                          if (this.model.get('senderJid')) {
                            //if it comes from webapp, jid can get by call attribute 'senderJid'
                            this.image = _converse.user_settings.avatarUrl + this.model.get('senderJid');
                          } else {
                            //if it comes from mobile, jid can get by split the attribute 'from'
                            this.image = _converse.user_settings.avatarUrl + this.model.get('from').split('/')[1].split('@')[0];
                          }

                        } else {
                          if (this.model.get('type') === 'chat') {
                            this.image = _converse.user_settings.avatarUrl + this.model.get('from').split('@')[0];
                          }
                        }
                    }
                    this.renderAvatar(msg);
                }
                await promise;
                this.replaceElement(msg);
                if (this.model.collection) {
                  this.model.collection.trigger('rendered', this);
                }
            },

            renderMedicalRequestStatus(status) {
              switch (status) {
                case 'IN_PROGRESS':
                  return this.model.get('isMedReqSender') ? __(medReqLabel.wait4Appro) : __(medReqLabel.wait4UrAppro);
                case 'DENIED':
                  return this.model.get('isMedReqSender') ? __(medReqLabel.wait4UrAppro) : __(medReqLabel.wait4Appro);
                case 'APPROVED':
                  if (this.model.get('senderSignedMedReq') && this.model.get('rcvrSignedMedReq')) {
                    return __(medReqLabel.approved);
                  } else {
                    if (this.model.get('isMedReqSender')) {
                      return this.model.get('senderSignedMedReq') ? __(medReqLabel.wait4Appro) : __(medReqLabel.wait4UrAppro);
                    } else {
                      return this.model.get('senderSignedMedReq') ? __(medReqLabel.wait4UrAppro) : __(medReqLabel.wait4Appro);
                    }
                  }
                case 'DELETED':
                  return __(medReqLabel.deleted);
                default:
                  return __(medReqLabel.expired);
              }
            },

            renderErrorMessage () {
                const moment_time = moment(this.model.get('time')),
                      msg = u.stringToElement(
                        tpl_info(_.extend(this.model.toJSON(), {
                            'extra_classes': 'chat-error',
                            'isodate': moment_time.format()
                        })));
                return this.replaceElement(msg);
            },

            renderChatStateNotification () {
                let text;
                const from = this.model.get('from'),
                      name = this.model.getDisplayName();

                if (this.model.get('chat_state') === _converse.COMPOSING) {
                    if (this.model.get('sender') === 'me') {
                        text = __('Typing from another device');
                    } else {
                        text = __('%1$s is typing', name);
                    }
                } else if (this.model.get('chat_state') === _converse.PAUSED) {
                    if (this.model.get('sender') === 'me') {
                        text = __('Stopped typing on the other device');
                    } else {
                        text = __('%1$s has stopped typing', name);
                    }
                } else if (this.model.get('chat_state') === _converse.GONE) {
                    text = __('%1$s has gone away', name);
                } else {
                    return;
                }
                const isodate = moment().format();
                this.replaceElement(
                      u.stringToElement(
                        tpl_csn({
                            'message': text,
                            'from': from,
                            'isodate': isodate
                        })));
            },

            renderFileUploadProgresBar () {
                const msg = u.stringToElement(tpl_file_progress(
                    _.extend(this.model.toJSON(), {
                        '__': __,
                        'filename': this.model.file.name,
                        'filesize': filesize(this.model.file.size)
                    })));
                this.replaceElement(msg);
                this.renderAvatar();
            },

            showConfirmDownloadImage (event) {
                // event.preventDefault();
                event.stopPropagation();
                _converse.emit('showPageMeFormConfirmDownload', event.target.id);
            },
            showPageMeMediaViewer (ev) {
              ev.preventDefault();
              _converse.emit('showPageMeMediaViewer', ev.target.id);
            },

            showPageMeMedicalRequest (ev) {
              _converse.emit('showPageMeMedicalRequest', ev.target.id);
            },

            showMessageVersionsModal (ev) {
                ev.preventDefault();
                if (_.isUndefined(this.model.message_versions_modal)) {
                    this.model.message_versions_modal = new _converse.MessageVersionsModal({'model': this.model});
                }
                this.model.message_versions_modal.show(ev);
            },

            getMessageText () {
                if (this.model.get('is_encrypted')) {
                    return this.model.get('plaintext') ||
                           (_converse.debug ? __('Unencryptable OMEMO message') : null);
                }

                return this.model.get('message');
            },

            isMeCommand () {
                const text = this.getMessageText();
                if (!text) {
                    return false;
                }
                return text.startsWith('/me ');
            },

            processMessageText () {
                var text = this.get('message');
                text = u.geoUriToHttp(text, _converse.geouri_replacement);
            },

            getExtraMessageClasses () {
                let extra_classes = this.model.get('is_delayed') && 'delayed' || '';
                if (this.model.get('type') === 'groupchat' && this.model.get('sender') === 'them') {
                    if (this.model.collection.chatbox.isUserMentioned(this.model)) {
                        // Add special class to mark groupchat messages
                        // in which we are mentioned.
                        extra_classes += ' mentioned';
                    }
                }
                if (this.model.get('correcting')) {
                    extra_classes += ' correcting';
                }
                return extra_classes;
            }
        });
    }
});
