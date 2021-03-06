// Converse.js (A browser based XMPP chat client)
// http://conversejs.org
//
// Copyright (c) 2013-2017, Jan-Carel Brand <jc@opkode.com>
// Licensed under the Mozilla Public License (MPLv2)
//
/*global define */

import "@converse/headless/converse-vcard";
import "converse-modal";
import _FormData from "formdata-polyfill";
import bootstrap from "bootstrap";
import converse from "@converse/headless/converse-core";
import tpl_chat_status_modal from "templates/chat_status_modal.html";
import tpl_client_info_modal from "templates/client_info_modal.html";
import tpl_profile_modal from "templates/profile_modal.html";
import tpl_profile_view from "templates/profile_view.html";
import tpl_status_option from "templates/status_option.html";


const { Strophe, $iq,  Backbone, Promise, utils, _, moment } = converse.env;
const u = converse.env.utils;


converse.plugins.add('converse-profile', {

    dependencies: ["converse-modal", "converse-vcard", "converse-chatboxviews"],

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this,
              { __ } = _converse;

        _converse.ProfileModal = _converse.BootstrapModal.extend({
            events: {
                'change input[type="file"': "updateFilePreview",
                'change select.main-speciality': "updateSubSpeciality",
                'click .change-avatar': "openFileSelection",
                'click .btn-block-contact': "BlockOrUnBlockContact",
                'submit .profile-form': 'onFormSubmitted'
            },


            initialize () {
                this.model.on('change', this.render, this);
                this.model.set({'specialities': [
                    {   main: 'Physician',
                        subs: ["Allergy & Immunology", "Anesthesiology", "Cardiac Surgery", "Cardiology", "Critical Care", "Dermatology", "Emergency Medicine", "Endocrinology", "Family Medicine", "Gastroenterology", "General Surgery", "Genetics", "Geriatrics", "Hematology", "Infectious Diseases", "Internal Medicine and Subspecialties", "Lab Medicine", "Medical Oncology", "Nephrology", "Neurology", "Neurosurgery", "Obstetrics and Gynaecology", "Ophthalmology", "Orthopaedic Surgery", "Otolaryngology - Head and Neck Surgery", "Palliative Medicine", "Pathology", "Pediatrics", "Pediatrics Subspecialits", "Physical Medicine and Rehabilitation", "Plastic Surgery", "Psychiatry", "Radiology and Nuclear Medicine", "Respirology", "Rheumatology", "Urology", "Vascular Surgery", "Other"],
                    },
                    {   main: 'Trainees',
                        subs: ["Medical Student", "Resident", "Fellow", "Other"]
                    },
                    {   main: 'Nursing Professional',
                        subs: ["Advanced Practice Registered Nurse", "Certified Nurse Midwife", "Certified Registered Nurse Anesthetist", "Clinical Nurse Specialist", "Nurse Practitioner", "Registered Nurse", "Registered Practical Nurse", "Other"]

                    },
                    {   main: 'Dentistry',
                        subs: ["General Practice Dentist", "Oral and Maxillofacial Surgery", "Orthodontist", "Pedodontist", "Periodontist", "Prosthodontist", "Other"]
                    },
                    {   main: 'Other Healthcare Professional',
                        subs: ["Acupuncturist", "Anatomist", "Audiologist", "Chiropractor", "Clinical Associate", "Dentistry and Subspecialties", "Dietitian", "Medical Educator", "Medical Librarian", "Medical Photographer", "Midwife", "Occupational Therapist", "Optometrist", "Orderly", "Paramedic", "Pathology Assistant", "Perfusionist", "Pharmacist", "Physician Assistant", "Physiotherapist", "Podiatrist", "Psychologist", "Respiratory Therapist", "Social Worker", "Speech-Language Pathologist", "Technician", "Technologist", "Veterinarian"]
                    }
                ]});
                this.model.set({'submitted': false});
                _converse.BootstrapModal.prototype.initialize.apply(this, arguments);
                _converse.emit('profileModalInitialized', this.model);
            },

            toHTML () {
                //this.model.vcard.image = _converse.user_settings.userProfile.avatarUrl;
                if (this.model.vcard) this.model.vcard.attributes.image = _converse.user_settings.userProfile.avatarUrl;
                return tpl_profile_modal(_.extend(
                    this.model.toJSON(),
                    this.model.vcard ? this.model.vcard.toJSON : {}, {
                    '_': _,
                    '__': __,
                    '_converse': _converse,
                    'alt_avatar': __('Your avatar image'),
                    'heading_profile': __('Profile'),
                    'label_close': __('Close'),
                    'label_email': __('Email'),
                    'label_fullname': __('Full Name'),
                    'label_jid': __('XMPP Address (JID)'),
                    'label_nickname': __('Nickname'),
                    'label_role': __('Role'),
                    'label_role_help': __('Use commas to separate multiple roles. Your roles are shown next to your name on your chat messages.'),
                    'label_url': __('URL'),
                    'label_speciality': "Speciality",
                    'label_saving': "Saving ...",
                    'utils': u,
                    'view': this
                }));
            },
            BlockOrUnBlockContact() {
                this.el.querySelector('.btn-block-contact').disabled = true;
                let jid = _converse.user_settings.jid.split('@')[0] + _converse.user_settings.domain;
                let iqBlockUser;
                 const iq = $iq({
                    to: jid,
                    type: "get"
                    }).c("query", {
                    "xmlns": "jabber:iq:privacy"
                });
                const iqBlockList = $iq({
                    to: jid,
                    type: "get"
                }).c("query", {
                    "xmlns": "jabber:iq:privacy"
                }).c("list", {
                    "name": "Block"
                });

                _converse.api.sendIQ(iq)
                .then(
                    result => {
                    if (result.querySelector('query') && result.querySelector('query').querySelector('list') && result.querySelector('query').querySelector('list').getAttribute('name') === "Block") {
                        _converse.api.sendIQ(iqBlockList).then(
                        blockList => {
                            //done later
                            let arrayJID = [];
                            if (!this.model.get('isBlocked')) {
                                blockList.querySelector('query').querySelector('list').querySelectorAll('item').forEach(item => {
                                    arrayJID.push(item.getAttribute('value'));
                                })
                                arrayJID.push(  (this.model.get('userName') || this.model.get('user_id')) + _converse.user_settings.domain);
                            } else {
                                blockList.querySelector('query').querySelector('list').querySelectorAll('item').forEach(item => {
                                    if (this.model.get('userName')) {
                                        if (item.getAttribute('value').split('@')[0] !== this.model.get('userName')) {
                                            arrayJID.push(item.getAttribute('value'));
                                        }
                                    }
                                    else {
                                        if (item.getAttribute('value').split('@')[0] !== this.model.get('user_id')) {
                                            arrayJID.push(item.getAttribute('value'));
                                        }
                                    }

                                })
                            }
                            if (arrayJID.length > 0) {
                                iqBlockUser = $iq({
                                    type: "set"
                                    }).c("query", {
                                    "xmlns": "jabber:iq:privacy"
                                    }).c("list", {
                                    "name": "Block"
                                })
                                arrayJID.forEach(jid => {
                                    iqBlockUser.c("item", {
                                        "xmlns": "jabber:iq:privacy",
                                        "type": "jid",
                                        "value": jid,
                                        "action": "deny",
                                        "order": arrayJID.indexOf(jid)
                                    }).c("message");
                                    if (arrayJID.indexOf(jid) !== arrayJID.length - 1) {
                                        iqBlockUser.up().up();
                                    }
                                });
                            }
                            else {
                                const removeBlockUser = $iq({
                                    type: "set"
                                }).c("query", {
                                    "xmlns" : "jabber:iq:privacy"
                                }).c("list", {
                                    "name" : "Block"
                                })
                                _converse.api.sendIQ(removeBlockUser).then(
                                    res => {
                                        this.model.set('isBlocked', !this.model.get('isBlocked'));
                                        this.el.querySelector('.btn-block-contact').disabled = false;
                                    },
                                    err => this.el.querySelector('.btn-block-contact').disabled = false
                                )
                                return;
                            }

                        _converse.api.sendIQ(iqBlockUser).then(
                        res => {
                            const activeBlockList = $iq({
                                to: jid,
                                type: "set"
                                }).c("query", {
                                "xmlns": "jabber:iq:privacy"
                                }).c("active", {
                                "name": "Block"
                            });
                            _converse.api.sendIQ(activeBlockList).then(
                            next => {
                                _converse.api.sendIQ(iqBlockList).then(
                                fina => {
                                    this.model.set('isBlocked', !this.model.get('isBlocked'));
                                    this.el.querySelector('.btn-block-contact').disabled = false;
                                },
                                err => this.el.querySelector('.btn-block-contact').disabled = false
                                )
                            },
                            err => {
                                this.el.querySelector('.btn-block-contact').disabled = false;
                            }
                            )
                        },
                        err => this.el.querySelector('.btn-block-contact').disabled = false
                        )
                        },
                        err => {
                            this.el.querySelector('.btn-block-contact').disabled = false
                        }
                    )
                    } else {
                        iqBlockUser = $iq({
                        type: "set"
                        }).c("query", {
                        "xmlns": "jabber:iq:privacy"
                        }).c("list", {
                        "name": "Block"
                        }).c("item", {
                        "xmlns": "jabber:iq:privacy",
                        "type": "jid",
                        "value": (this.model.get('userName') || this.model.get('user_id')) + _converse.user_settings.domain,
                        "action": "deny",
                        "order": "0"
                        }).c("message");
                        _converse.api.sendIQ(iqBlockUser).then(
                        res => {
                            const activeBlockList = $iq({
                            to: jid,
                            type: "set"
                            }).c("query", {
                            "xmlns": "jabber:iq:privacy"
                            }).c("active", {
                            "name": "Block"
                            });
                            _converse.api.sendIQ(activeBlockList).then(
                            next => {
                                _converse.api.sendIQ(iqBlockList).then(
                                fina => {
                                    this.model.set('isBlocked', !this.model.get('isBlocked'));
                                    this.el.querySelector('.btn-block-contact').disabled = false;
                                },
                                err => console.log(err)
                                )
                            },
                            err => console.log(err)
                            )
                        },
                        err => console.log(err)
                        )
                    }
                    },
                    err => console.log(err)
                )

            },
            afterRender () {
                this.tabs = _.map(this.el.querySelectorAll('.nav-item'), (tab) => new bootstrap.Tab(tab));
                var mainSpecialityDOM = this.el.querySelectorAll('.main-speciality')[0];
                if (mainSpecialityDOM) {
                    mainSpecialityDOM.options.length = 0; // clear data
                    var currentMainSpecIndex = this.model.get('specialities').findIndex(speciality => this.model.get('title') && this.model.get('title').includes(speciality.main + '+'));

                    this.model.get('specialities').forEach((speciality, i) => {
                        var opt = document.createElement('option');
                        opt.textContent = speciality.main;
                        opt.value = i;
                        opt.selected = currentMainSpecIndex === i
                        mainSpecialityDOM.appendChild(opt);
                    })

                    this.updateSubSpeciality();
                }
            },

            updateSubSpeciality(){
                var mainSpecialityDOM = this.el.querySelectorAll('.main-speciality')[0];
                var subSpecialityDOM = this.el.querySelectorAll('.sub-speciality')[0];
                if (subSpecialityDOM) {
                    subSpecialityDOM.options.length = 0;// clear data

                    var findMain = this.model.get('specialities')[mainSpecialityDOM.options[mainSpecialityDOM.selectedIndex].value];
                    if (findMain) {
                        findMain.subs.forEach((subSpeciality, i) => {
                            var findSubSpecIndex = findMain.subs.findIndex(subSpeciality => this.model.get('title') && this.model.get('title').includes(findMain.main + '+' + subSpeciality));

                            var opt = document.createElement('option');
                            opt.textContent = subSpeciality;
                            opt.value = i;
                            opt.selected = findSubSpecIndex === i;
                            subSpecialityDOM.appendChild(opt);
                        })
                    }
                }
            },

            openFileSelection (ev) {
                if (this.model.get('isMemberProfile')) return;

                ev.preventDefault();
                this.el.querySelector('input[type="file"]').click();
            },

            updateFilePreview (ev) {
                const file = ev.target.files[0],
                      reader = new FileReader();
                reader.onloadend = () => {
                    this.el.querySelector('.avatar').setAttribute('src', reader.result);
                };
                reader.readAsDataURL(file);
            },

            setVCard (data) {
                _converse.api.vcard.set(_converse.bare_jid, data)
                .then(() => _converse.api.vcard.update(this.model.vcard, true))
                .catch((err) => {
                    _converse.log(err, Strophe.LogLevel.FATAL);
                    _converse.api.alert.show(
                        Strophe.LogLevel.ERROR,
                        __('Error'),
                        [__("Sorry, an error happened while trying to save your profile data."),
                        __("You can check your browser's developer console for any error output.")]
                    )
                });
                this.modal.hide();
            },

            onFormSubmitted (ev) {
                ev.preventDefault();
                this.model.set({'submitted': true});
                const reader = new FileReader(),
                      form_data = new FormData(ev.target),
                      image_file = form_data.get('image');
                // const data = {
                //     'fn': form_data.get('fn'),
                //     'nickname': form_data.get('nickname'),
                //     'role': form_data.get('role'),
                //     'email': form_data.get('email'),
                //     'url': form_data.get('url'),
                // };
                var data = {
                    fullName: form_data.get('fullName'),
                    title: this.model.get('specialities')[form_data.get('main-speciality')].main + '+' + this.model.get('specialities')[form_data.get('main-speciality')].subs[form_data.get('sub-speciality')],
                    avatarUrl: `${_converse.user_settings.avatarUrl}${this.model.get('userName')}` + '?t=' + new Date().getTime()
                }

                _converse.emit('editUserProfile', data, image_file,  () => {
                    _converse.emit('editUserProfileCompleted', data.avatarUrl)

                    this.model.set(data);
                    _converse.user_settings.userProfile.avatarUrl = this.model.get('avatarUrl');
                    // _converse.xmppstatusview.image = this.model.get('avatarUrl');
                    if (!image_file.size) {
                        _.extend(data, {
                            'image': this.model.vcard.get('image'),
                            'image_type': this.model.vcard.get('image_type')
                        });
                        if (this.model.vcard) this.setVCard(data);
                    } else {
                        reader.onloadend = () => {
                            _.extend(data, {
                                'image': btoa(reader.result),
                                'image_type': image_file.type
                            });
                            if (this.model.vcard) this.setVCard(data);
                        };
                        reader.readAsBinaryString(image_file);
                    }
                });
            }
        });

        _converse.ChatStatusModal = _converse.BootstrapModal.extend({
            events: {
                "submit form#set-xmpp-status": "onFormSubmitted",
                "click .clear-input": "clearStatusMessage"
            },

            toHTML () {
                return tpl_chat_status_modal(
                    _.extend(
                        this.model.toJSON(),
                        this.model.vcard.toJSON(),
                        {
                          'label_close': __('Close'),
                          'label_cancel': __('Cancel'),
                          'label_save': __('Save'),
                          'modal_title': __('My Status'),
                          'placeholder_status_message': __('Personal status message')
                        }
                    ));
            },

            afterRender () {
                this.el.addEventListener('shown.bs.modal', () => {
                    // this.el.querySelector('input[name="status_message"]').focus();
                }, false);
            },

            clearStatusMessage (ev) {
                if (ev && ev.preventDefault) {
                    ev.preventDefault();
                    u.hideElement(this.el.querySelector('.clear-input'));
                }
                const roster_filter = this.el.querySelector('input[name="status_message"]');
                roster_filter.value = '';
            },

            onFormSubmitted (ev) {
                ev.preventDefault();
                const data = new FormData(ev.target);
                this.model.save({
                    'statusMessage': data.get('status_message'),
                    'pageMeStatus': data.get('chat_status')
                });
                const key = `${_converse.user_settings.jid.split('@')[0]}-status-cached`;
                localStorage.setItem(key,null);

                this.modal.hide();
                _converse.emit('statusFormSubmitted', {
                  status: data.get('chat_status'),
                  statusMessage: data.get('status_message')
                });
            }
        });

        _converse.ClientInfoModal = _converse.BootstrapModal.extend({

            toHTML () {
                return tpl_client_info_modal(
                    _.extend(
                        this.model.toJSON(),
                        this.model.vcard.toJSON(), {
                            '__': __,
                            'modal_title': __('About'),
                            'version_name': _converse.VERSION_NAME,
                            'first_subtitle': __( '%1$s Open Source %2$s XMPP chat client brought to you by %3$s Opkode %2$s',
                                '<a target="_blank" rel="nofollow" href="https://conversejs.org">',
                                '</a>',
                                '<a target="_blank" rel="nofollow" href="https://opkode.com">'
                            ),
                            'second_subtitle': __('%1$s Translate %2$s it into your own language',
                                '<a target="_blank" rel="nofollow" href="https://hosted.weblate.org/projects/conversejs/#languages">',
                                '</a>'
                            )
                        }
                    )
                );
            }
        });

        _converse.XMPPStatusView = _converse.VDOMViewWithAvatar.extend({
            tagName: "div",
            events: {
                // "click span.currentName": "showSettingModal",
                "click a.show-preferences": "showPreferencesModal",
                "click .change-status": "showStatusChangeModal",
                "click .show-client-info": "showClientInfoModal",
                "click .logout": "logOut"
            },

            initialize () {
                const key = `${_converse.user_settings.jid.split('@')[0]}-status-cached`;

                const initStatus = localStorage.getItem(key);
                if (initStatus !== null) {
                  const data = JSON.parse(initStatus);
                  this.model.save({
                      'statusMessage': data.statusMessage,
                      'pageMeStatus': data.status
                  });
                }
                this.model.on("change", this.render, this);
                this.model.vcard.on("change", this.render, this);
                this.model.on("change:avatarUrl", this.afterRender, this);
                this.model.save({
                    'avatarUrl': _converse.user_settings.avatarUrl + _converse.user_settings.jid.split('@')[0],
                    'fullName': _converse.user_settings.fullname
                })
                _converse.on('numRequestChange', (num) => {
                    this.model.save({
                        'numRequest': num
                    })
                })
                _converse.on("disabledNotificationFromCore", state => {
                  this.model.set("stateNotification", state);
                })
                _converse.on('updateProfile', data => {
                    this.model.save({
                        'avatarUrl' : data.avatarUrl,
                        'fullName' : data.fullName
                    });
                })
            },

            toHTML () {
                const chat_status = this.model.get('status') || 'offline';
                return tpl_profile_view(_.extend(
                    this.model.toJSON(),
                    this.model.vcard.toJSON(), {
                    '__': __,
                    'fullName': this.model.get('fullName') || 'Loading...',
                    'organizations': _converse.user_settings.organizations,
                    'status_message': this.model.get('status_message') ||
                                        __("I am %1$s", this.getPrettyStatus(chat_status)),
                    'chat_status': chat_status,
                    '_converse': _converse,
                    'title_change_settings': __('Change settings'),
                    'title_change_status': __('Click to change your chat status'),
                    'title_log_out': __('Log out'),
                    'info_details': __('Show details about this chat client'),
                    'title_your_profile': __('Your profile')
                }));
            },

            afterRender () {
                const jid = Strophe.getNodeFromJid(_converse.bare_jid);
                // this.image = `${_converse.user_settings.avatarUrl}${jid}`;
                this.image = this.model.get('avatarUrl');
                this.renderAvatar();
            },

            showProfileModal (ev) {
                if (!_.isUndefined(this.profile_modal)) {
                    this.profile_modal.remove();
                }
                this.profile_modal = new _converse.ProfileModal({model: this.model});
                this.profile_modal.show(ev);
            },

            showPreferencesModal (ev) {
                ev.preventDefault();
                _converse.emit('openPreferencesModal');
            },

            showStatusChangeModal (ev) {
                if (localStorage.getItem('isOrganizationJoined') !== 'true') {
                    return;
                }
                if (!_.isUndefined(this.status_modal)) {
                    this.status_modal.remove();
                }
                this.status_modal = new _converse.ChatStatusModal({model: this.model});
                this.status_modal.show(ev);

            },

            showClientInfoModal(ev) {
                if (_.isUndefined(this.client_info_modal)) {
                    this.client_info_modal = new _converse.ClientInfoModal({model: this.model});
                }
                this.client_info_modal.show(ev);
            },

            logOut (ev) {
                ev.preventDefault();
                const result = confirm(__("Are you sure you want to log out?"));
                if (result === true) {
                    _converse.logOut();
                }
            },

            getPrettyStatus (stat) {
                if (stat === 'chat') {
                    return __('online');
                } else if (stat === 'dnd') {
                    return __('busy');
                } else if (stat === 'xa') {
                    return __('away for long');
                } else if (stat === 'away') {
                    return __('away');
                } else if (stat === 'offline') {
                    return __('offline');
                } else {
                    return __(stat) || __('online');
                }
            }
        });
    }
});
