/*jslint unparam: true, white: true, browser: true */
/*global FileReader: true, File: true, alert: true, jQuery: true */
function init() {
    "use strict";
    var KeePass = window.KeePass;
    var PERCENT_RE = /\b(\d{1,3})%/;
    var droppedFiles = [];

    $(function () {
            var opening = false;
            var passwordToggle = '<a href="#" class="password-toggle hidden">Show password</a>';

            function readFiles(file, callback) {
                if (file === "") {
                    alert("wtf?");
                    return false;
                }
                var storage = navigator.getDeviceStorage("sdcard");

                var reader = new FileReader();

                reader.onload = function () {
                    alert(reader.result);
                    var fileGet = {
                        data: reader.result
                    };

                    callback(fileGet);
                }

                var kdb_file = storage.get(file);

                kdb_file.onsuccess = function () {
                    var file = this.result;
                    //alert(file.name);
                    //function doRead(kdb_file) {
                    //No llega a entrar aqui
                    //}
                    alert(file.name);
                    reader.readAsBinaryString(file);
                    alert("yaaay");
                    //doRead(file.name);
                    console.log("Obtenido el archivo: " + file.name);
                }

                kdb_file.onerror = function () {
                    alert("nope");
                    $('#open').attr('disabled', null);
                    console.error("Error in: ", kdb_file.error.name);
                }
            }

            function pwMask(len) {
                /* Could also be done by (new Array(len)).join('*');, but lint no likey. */
                var result = '',
                    i;
                for (i = 0; i < len; i += 1) {
                    result += '*';
                }
                return result;
            }

            function createEntry(entry) {
                var binary = (
                    entry.binaryData ?
                    '<a href="data:application/octet-stream;base64,' + encodeURIComponent((window.btoa || base64.encode)(entry.binaryData)) + '"' + (entry.binaryDescription ? ' download="' + encodeURIComponent(entry.binaryDescription) + '"' : '') + '>' + (entry.binaryDescription || 'Attached file') + '</a>' :
                    ''
                ),
                    entryMarkup = $('<tr><td class="title"><a href="' + entry.url + '">' + entry.title + '</a></td><td class="userName">' + entry.userName + '</td><td class="password"><span>' + pwMask(entry.password.length) + '</span>' + passwordToggle + '</td><td class="notes"><pre>' + entry.additional + '</pre></td><td>' + binary + '</td></tr>');
                entryMarkup.find('.password-toggle').click(function (ev) {
                    ev.preventDefault();
                    var $this = $(this),
                        $field = $this.parent();
                    if ($this.hasClass('hidden')) {
                        $this.text('Hide password');
                        $field.find('span').hide();
                        $field.prepend($('<input type="text" value="' + entry.password + '"/>'));
                    } else {
                        $this.text('Show password');
                        $field.find('span').show();
                        $field.find('input').remove();
                    }
                    $this.toggleClass('hidden');
                });
                return entryMarkup;
            }

            function doNotDisplay(entry) {
                return (entry.title === 'Meta-Info' &&
                    entry.userName === 'SYSTEM' &&
                    entry.url === '$' &&
                    entry.additional === "KPX_GROUP_TREE_STATE");
            }

            function createSubGroups(groups, container) {
                var g, e = null,
                    l = $('<ul class="groups"></ul>'),
                    groupMarkup, entriesContainer, entryMarkup, entry;

                container.append(l);
                for (g = 0; g < groups.length; g += 1) {
                    groupMarkup = $('<li><a class="group-name" href="#">' + groups[g].name + '</a></li>');
                    entriesContainer = $('<table class="entries"><thead><tr><th class="title">Title</th><th class="userName">Username</th><th class="password">Password</th><th class="notes">Notes</th><th class="attachment">Attachment</th></tr></thead></table>');

                    for (e in groups[g].entries) {
                        if (groups[g].entries.hasOwnProperty(e) && !doNotDisplay(groups[g].entries[e])) {
                            entry = groups[g].entries[e];
                            entryMarkup = createEntry(entry);
                            entriesContainer.append(entryMarkup);
                        }
                    }
                    groupMarkup.append(entriesContainer);
                    l.append(groupMarkup);

                    createSubGroups(groups[g].subGroups, groupMarkup);
                }
            }

            function opened(e) {
                var container = $('#db-contents'),
                    manager = e.manager,
                    groups = manager.database.subGroups;

                $('#open').removeAttr('disabled');
                $('#spinner').hide();
                opening = false;

                createSubGroups(groups, container);
                $('#keepassopenform').hide();
                $('#db-contents-wrapper').show();
            }

            document.addEventListener('keePassDatabaseOpen', opened);

            function openFailed(e) {
                var manager = e.manager,
                    message = e.exception,
                    $errors = $('#errors');

                $('#spinner').hide();
                opening = false;

                manager.status(null);
                $('#open').removeAttr('disabled');
                $errors.text(message);
                $errors.slideDown();
            }

            document.addEventListener('keePassDatabaseOpenError', openFailed);

            function statusCallback(msg) {
                var $status = $('#status'),
                    $message = $status.find('p'),
                    $progress = $status.find('progress'),
                    $spinner = $status.find('img'),
                    percentage;
                if (msg === null) {
                    $message.hide();
                    $progress.hide();
                    $spinner.hide();
                } else {
                    percentage = PERCENT_RE.test(msg) ? PERCENT_RE.exec(msg)[1] : null;
                    if (percentage !== null) {
                        $progress.attr('value', percentage);
                        $progress.text(percentage + '%');
                        $spinner.hide();
                        $progress.show();
                    } else {
                        $progress.hide();
                        $spinner.show();
                    }
                    $message.text(msg);
                    $message.show();
                }
            }

            function process() {
                var key = $('#password').val(),
                    diskDrive = !! $('#use_keyfile:checked').length,
                    providerName = 'KeePassJS',
                    manager = new KeePass.Manager(statusCallback);


                if (opening) {
                    return;
                }
                opening = true;
                $('#open').attr('disabled', 'disabled');

                function loadWithKeyFile(keyFile) {
                    readFiles($('#keepassfile').text(), function (file) {
                        manager.setMasterKey(
                            key,
                            diskDrive,
                            keyFile,
                            providerName);
                        manager.open(file.data);
                    });
                }

                if (diskDrive) {
                    readFiles($('#keyfile').get(0).files, function (keyfile) {
                        loadWithKeyFile(keyfile);
                    });
                } else {
                    loadWithKeyFile(null);
                }
            }


            /*
		openButton = document.querySelector("open");
		openButton.addEventListener('click', function(){
			process();
		});
		*/

            $('#open').bind('click', function (ev) {
                //ev.preventDefault();
                process();
            });

            /*
        keepassOpen = document.querySelector("keepassopenform");
		keepassOpen.addEventListener('submit', function(){
			process();
		});
        */

            $('#keepassopenform').bind('submit', function (ev) {
                ev.preventDefault();
                process();
            });


            $('#db-contents').on('click', 'a.group-name', function (ev) {
                ev.preventDefault();
                $('#db-contents table').hide();
                $(this).parent().children('table').show();
            });

            $('#close').bind('click', function (ev) {
                ev.preventDefault();
                $('#db-contents').text('');
                $('#db-contents-wrapper').hide();
                $('#keepassopenform').show();
                $("#keepassopenform input:not([type='button'])").each(function () {
                    $(this).val('');
                });
                $("#keepassopenform input:first").focus();
            });

        //}
    //});
//} //());

window.addEventListener('load', function browserOnLoad(evt) {
    window.removeEventListener('load', browserOnLoad);
    alert("POLLA");
    init();
});