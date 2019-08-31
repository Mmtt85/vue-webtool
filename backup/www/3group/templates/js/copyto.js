var ssh_target_vue_list = {};
var ssh_output_vue_list = {};
var ssh_cli_execute_vue_list = {};

var api_server = global_config.api_server;

$(document).ready(function() {
  initVueObjects();

  initPage();
});

////////////////////// INIT //////////////////////
function initVueObjects() {
  makeSshTargetIptVueObj('ipt_target_server').value = '192.168.21.58';
  makeSshTargetIptVueObj('ipt_target_dir').value = '/mnt/shared/sourcecode';
  makeSshTargetIptVueObj('ipt_account_name').value = 'root';
  makeSshTargetIptVueObj('ipt_account_password').value = '1111';

  makeGetInfoDataBtnVueObj('btn_get_data');
  makeInfoOutputDivVueObj('div_info_copyto_output');
}
function initPage() {
  initPageData();
  initPageEvents();
}

function initPageData() {
  getInformationFiles();
}

function initPageEvents() {
  /* in common.js */
  C_SelectValueOfClickInputInThisPage();
  C_ConvertCheckbox();
  initLockEvent();
}

function initLockEvent() {
  $('#chk_execute_lock').on('ifChanged', function() {
    var curr_info_idx =
      ssh_output_vue_list['div_info_copyto_output'].curr_info_idx;
    checkLock(curr_info_idx);
    executeButtonEvent(curr_info_idx);
  });
}

///////////////////// VUE /////////////////////
/* ターゲットサーバーに対する情報入力エレメントのvue objs */
function makeSshTargetIptVueObj(el_id) {
  ssh_target_vue_list[el_id] = new Vue({
    el: '#' + el_id,
    data: { value: '' }
  });

  return ssh_target_vue_list[el_id];
}

/* copyto機能のmain vue */
function makeInfoOutputDivVueObj(el_id) {
  ssh_output_vue_list[el_id] = new Vue({
    el: '#' + el_id,
    data: {
      informations: [],
      curr_info_idx: -1,
      curr_info: {}
    },
    methods: {
      getCurrentInfo: function(idx) {
        this.curr_info_idx = idx;
        this.curr_info = this.informations[idx];
        checkLock(idx);
        executeButtonEvent(idx);
      },
      editInfoFileName: function() {
        var $this = this;

        if (this.curr_info_idx > -1) {
          var copen_modal_title =
            "<span class='ui-icon ui-icon-circle-check mr-1'></span><span class='align-middle'>infomation file名変更</span>";
          var copen_modal_body =
            "<div class='input-group mb-2 p-0'><span class='input-group-btn'><button class='btn btn-info right-no-radius pt-1 pb-1' type='button' disabled>ファイル名</button></span><input id='ipt_edit_info_file_name' class='form-control pt-1 pb-1' value='" +
            $this.curr_info.file_name_only +
            "'></div>";
          C_OpenModalWindow(
            copen_modal_title,
            copen_modal_body,
            true,
            false,
            30,
            function() {
              if (
                $('#ipt_edit_info_file_name').val() === '' ||
                $('#ipt_edit_info_file_name')
                  .val()
                  .match(/\\|\/|:|\*|\?|"|<|>|\|| /g)
              ) {
                C_OpenAlertWindow(
                  '特殊記号 「/:*?"<>| 」 又は空白はファイル名として入力できません。',
                  'alert-danger',
                  30,
                  4,
                  3
                );
                return false;
              }
              updated_file_name =
                getSshTargetInfo()['target_dir'] +
                '/' +
                $('#ipt_edit_info_file_name').val() +
                '.info';
              $this.curr_info.updated_file_name = updated_file_name;
              $this.updateInfoFile($this.curr_info_idx, true, 'ファイル名修正');
              $this.informations = [];
              $this.curr_info_idx = -1;
            }
          );
        } else {
          C_OpenAlertWindow(
            'informationファイルを選択してください。',
            'alert-danger',
            30,
            3,
            3
          );
        }
      },
      updateInfoFile: function(idx, open_alert = false, open_alert_title = '') {
        var $this = this;
        ajax_data = getSshTargetInfo();

        var curr_info = this.informations[idx];

        ajax_data['info_json_data'] = curr_info;

        $.ajax({
          url: api_server + '/api_ssh/set_information_file',
          type: 'post',
          data: { json_ajax_data: JSON.stringify(ajax_data) },
          dataType: 'json',
          success: function(result) {
            if (open_alert === true) {
              C_OpenAlertWindow(
                open_alert_title + '成功: 「' + curr_info.file_name_only + '」',
                'alert-success',
                50,
                2,
                2
              );
            }
            getInformationFiles();
          },
          error: function(error) {
            C_OpenAlertWindow(
              open_alert_title + '失敗: 「' + curr_info.file_name_only,
              'alert-danger' + '」',
              40,
              4,
              3
            );
          }
        });
      },
      openPage: function(idx) {
        var url = this.informations[idx].config.remote_server;
        var win = window.open('http://' + url.replace('http://', ''));
      },
      copyAndPatch: function(idx) {
        this.updateInfoFile(idx);
        checkAutoYesAndExecute(
          'コピー &amp; パッチ',
          this.informations[idx],
          '-f'
        );
      },
      backupList: function(idx) {
        sshOptionExecute(this.informations[idx].file_name, '--list');
      },
      tree: function(idx) {
        sshOptionExecute(this.informations[idx].file_name, '--tree');
      },
      rollback: function(idx) {
        checkAutoYesAndExecute(
          'ロールバック',
          this.informations[idx],
          '--rollback'
        );
      },
      lastLog: function(idx) {
        showLog();
      },
      addInformation: function(file_name, data) {
        var project_name,
          source_name,
          remote_server,
          issue_num,
          compile_option,
          user,
          password,
          auto_yes = 'n',
          auto_patch = 'n';
        var updated_files = [],
          ignore_files = [];
        var is_ignore_files = false;
        var informations = this.informations;

        $.each(data.split('\n'), function(i, line) {
          if (
            line.match(/.*#.*/) ||
            line.length === 0 ||
            line === '\n' ||
            line === '\r\n'
          ) {
            return true;
          } else if (line.match(/.*\[.*\].*/)) {
            if (line.match(/.*\[.*ignore.*\].*/)) {
              is_ignore_files = true;
            }
            return true;
          }

          line = line.replace(/\"/g, '');
          line = line.trim();

          if (is_ignore_files === true) ignore_files.push(line);
          else if (line.match(/project_name=/))
            project_name = line.split('project_name=')[1];
          else if (line.match(/source_name=/))
            source_name = line.split('source_name=')[1];
          else if (line.match(/remote_server=/))
            remote_server = line.split('remote_server=')[1];
          else if (line.match(/issue_num=/))
            issue_num = line.split('issue_num=')[1];
          else if (line.match(/compile_option=/))
            compile_option = line.split('compile_option=')[1];
          else if (line.match(/user=/)) user = line.split('user=')[1];
          else if (line.match(/password=/))
            password = line.split('password=')[1];
          else if (line.match(/auto_yes=/))
            auto_yes = line.split('auto_yes=')[1];
          else if (line.match(/auto_patch=/))
            auto_patch = line.split('auto_patch=')[1];
          else if (line.match(/.*:.*/)) updated_files.push(line);
        });

        // in vo.js
        var info = new Information(
          project_name,
          file_name,
          source_name,
          remote_server,
          issue_num,
          compile_option,
          user,
          password,
          auto_yes,
          auto_patch,
          updated_files,
          ignore_files
        );

        var is_exist_in_informations = false;
        $.each(informations, function(idx, data) {
          if (data.file_name === info.getFileName()) {
            data = info.information;
            is_exist_in_informations = true;
            return false;
          }
        });

        if (is_exist_in_informations === false) {
          this.informations.push(info.information);
        }
      },
      delInfoFile: function() {
        var $this = this;

        if ($this.curr_info_idx > -1) {
          var ajax_data = getSshTargetInfo();
          ajax_data['info_json_data'] = this.informations[this.curr_info_idx];
          var copen_modal_title =
            "<span class='ui-icon ui-icon-help mr-1'></span><span class='align-middle'>確認</span>";
          var copen_modal_body =
            '「' +
            ajax_data['info_json_data']['file_name_only'] +
            '」を削除しますか？';
          C_OpenModalWindow(
            copen_modal_title,
            copen_modal_body,
            true,
            false,
            30,
            function() {
              $.ajax({
                url: api_server + '/api_ssh/del_information_file',
                type: 'post',
                data: { json_ajax_data: JSON.stringify(ajax_data) },
                dataType: 'json',
                success: function(result) {
                  $this.informations = [];
                  $this.curr_info_idx = -1;
                  C_OpenAlertWindow(
                    '削除成功: 「' + $this.curr_info.file_name_only + '」',
                    'alert-success',
                    50,
                    2,
                    1.5
                  );
                  getInformationFiles();
                },
                error: function(error) {
                  C_OpenAlertWindow(
                    '削除失敗: 「' + error + '」',
                    'alert-danger',
                    30,
                    4,
                    3
                  );
                }
              });
            }
          );
        } else {
          C_OpenAlertWindow(
            'informationファイルを選択してください。',
            'alert-danger',
            30,
            3,
            3
          );
        }
      },
      createInfoFile: function() {
        var $this = this;
        C_OpenIptModalWindow(
          'infomation file追加',
          'ファイル名',
          'ipt_add_info_file',
          false,
          30,
          function() {
            if (
              $('#ipt_add_info_file').val() === '' ||
              $('#ipt_add_info_file')
                .val()
                .match(/\\|\/|:|\*|\?|"|<|>|\|| /g)
            ) {
              C_OpenAlertWindow(
                '特殊記号 「/:*?"<>| 」 や空白はファイル名として入力できません。',
                'alert-danger',
                30,
                4,
                3
              );
              return false;
            }
            $this.addInformation(
              getSshTargetInfo()['target_dir'] +
                '/' +
                $('#ipt_add_info_file').val() +
                '.info',
              ''
            );
            $this.updateInfoFile(
              $this.informations.length - 1,
              true,
              'ファイル生成'
            );
            $this.informations = [];
            $this.curr_info_idx = -1;
          }
        );
      }
    }
  });
}

function makeGetInfoDataBtnVueObj(el_id) {
  ssh_target_vue_list[el_id] = new Vue({
    el: '#' + el_id,
    methods: {
      getData: function(event) {
        var is_valid_target_info = true;
        $.each(ssh_target_vue_list, function(idx, data) {
          if (data.$el.type === 'text' || data.$el.type === 'password') {
            if (data.value === '') {
              is_valid_target_info = false;
              return false;
            }
          }
        });
        if (is_valid_target_info) {
          ssh_output_vue_list['div_info_copyto_output'].informations = [];
          ssh_output_vue_list['div_info_copyto_output'].curr_info_idx = -1;
          getInformationFiles();
        } else {
          C_OpenAlertWindow(
            'ターゲットの情報を全て入力してください。',
            'alert-danger',
            30,
            3,
            3
          );
        }
      }
    }
  });
}

//////////////////////// COMMON ////////////////////////
/* get data of information files in target directory from target api server */
function getInformationFiles() {
  var ajax_data = getSshTargetInfo();
  $.ajax({
    url: api_server + '/api_ssh/get_information_files',
    type: 'post',
    data: { json_ajax_data: JSON.stringify(ajax_data) },
    dataType: 'json',
    success: function(result) {
      $.each(result, function(file_name, data) {
        ssh_output_vue_list['div_info_copyto_output'].addInformation(
          file_name,
          data
        );
      });
    },
    error: function(error) {
      ssh_output_vue_list['div_info_copyto_output'].informations = [];
      ssh_output_vue_list['div_info_copyto_output'].curr_info_idx = -1;
      C_OpenAlertWindow(
        'error: 「' + error['responseJSON'] + '」',
        'alert-danger',
        30,
        5,
        3
      );
    }
  });
}

function getSshTargetInfo() {
  return {
    target_server: ssh_target_vue_list['ipt_target_server'].value,
    target_dir: ssh_target_vue_list['ipt_target_dir'].value,
    account_name: ssh_target_vue_list['ipt_account_name'].value,
    account_password: ssh_target_vue_list['ipt_account_password'].value
  };
}

function showLog() {
  var ajax_data = getSshTargetInfo();
  ajax_data['cli_command'] =
    'cd ' +
    getSshTargetInfo()['target_dir'] +
    ';' +
    'python copyto.py --showlog';
  C_OpenModalWindow('last log', null, false, true, 0, null);
  $.ajax({
    url: api_server + '/api_ssh/execute_cli_command',
    type: 'post',
    data: { json_ajax_data: JSON.stringify(ajax_data) },
    dataType: 'json',
    success: function(result) {
      $('#modal_body').html(
        "<pre id='pre_copyto_result' class='m-0 mh-75-vh'>" + result + '</pre>'
      );
    }
  });
}

/* cli commandを対象サーバーで実行 */
function sshExecute(cli_command, success_func) {
  var ajax_data = getSshTargetInfo();
  ajax_data['cli_command'] = cli_command;

  $.ajax({
    url: api_server + '/api_ssh/execute_cli_command',
    type: 'post',
    data: { json_ajax_data: JSON.stringify(ajax_data) },
    dataType: 'json'
  });

  ajax_data['cli_command'] =
    'cat ' + getSshTargetInfo()['target_dir'] + '/copyto.log';
  if (typeof success_func === 'function') {
    var first_of_loop = true;
    var current_server_state = setInterval(function() {
      $.ajax({
        url: api_server + '/api_ssh/execute_cli_command',
        type: 'post',
        data: { json_ajax_data: JSON.stringify(ajax_data) },
        dataType: 'json',
        success: function(result) {
          if (result !== '') success_func(result);
          if ($('#pre_copyto_result')[0] !== undefined) {
            $('#pre_copyto_result').animate(
              {
                scrollTop: $('#pre_copyto_result')[0].scrollHeight
              },
              0
            );
          }
          last_of_line = result.split('\n')[result.split('\n').length - 1];
          if (!first_of_loop && last_of_line === 'done.') {
            $('#img_loader').remove();
            clearInterval(current_server_state);
          } else {
            first_of_loop = false;
          }
        }
      });
    }, 300);
  }
}

/* copyto.pyツールのオプションをいれて実行 */
/* オプション：-f -c -r -m -l -p -t -h */
function sshOptionExecute(file_name, option) {
  var cli_command = 'cd ' + getSshTargetInfo()['target_dir'] + ';';
  cli_command += 'python copyto.py ' + option + ' ' + file_name + ';';

  var copen_modal_title =
    "<span class='ui-icon ui-icon-circle-check mr-1'></span><span class='align-middle'>" +
    file_name +
    '</span>';
  C_OpenModalWindow(copen_modal_title, null, false, true, 0, null);

  sshExecute(cli_command, function(result) {
    $('#modal_body').html(
      "<pre id='pre_copyto_result' class='m-0 mh-75-vh'>" +
        result +
        "<br><img id='img_loader' class='m-3' src='/templates/images/loader.gif'></pre>"
    );
  });
}

/* auto_yesがyの場合のみ、実行させる */
function checkAutoYesAndExecute(title, curr_info, option) {
  var auto_yes = curr_info.config.auto_yes;
  if (
    auto_yes === 'y' ||
    auto_yes === 'Y' ||
    auto_yes === 'true' ||
    auto_yes === 'True' ||
    auto_yes === true
  ) {
    var copen_modal_title =
      "<span class='ui-icon ui-icon-help mr-1'></span><span class='align-middle'>" +
      title +
      '</span>';
    var copen_modal_body =
      '「' + curr_info.config.remote_server + '」 実行しますか？';
    C_OpenModalWindow(
      copen_modal_title,
      copen_modal_body,
      true,
      true,
      30,
      function() {
        sshOptionExecute(curr_info.file_name, option);
      }
    );
  } else {
    C_OpenAlertWindow(
      'AUTO_YESが「y」でなければ、自動実行はできません。',
      'alert-danger',
      30,
      4,
      3
    );
    ssh_output_vue_list['div_info_copyto_output'];
  }
}

function checkLock(curr_info_idx) {
  $.each(
    $(
      '#btn_patch_' +
        curr_info_idx +
        ', #btn_rollback_' +
        curr_info_idx +
        ', #btn_update_' +
        curr_info_idx
    ),
    function(i, e) {
      if ($('#chk_execute_lock').is(':checked')) {
        $(e).attr('disabled', true);
      } else {
        $(e).attr('disabled', false);
      }
    }
  );
}

function executeButtonEvent(curr_info_idx) {
  setTimeout(function() {
    $.each(
      $(
        '#btn_patch_' +
          curr_info_idx +
          ', #btn_rollback_' +
          curr_info_idx +
          ', #btn_update_' +
          curr_info_idx
      ),
      function(i, e) {
        $overlay = C_MakeOverlay(this);
        if ($('#chk_execute_lock').is(':checked')) {
          $(this).append($overlay);
          $overlay.off();
          $overlay.on('click', function() {
            $('html, body').animate(
              {
                scrollTop: $('#div_info_show').position().top + 300
              },
              150
            );
            $('#lbl_chk_lock').C_AnimateCss('flash');
          });
        } else {
          $overlay.off();
          $('#' + $overlay.attr('id')).remove();
        }
      }
    );
  }, 1);
}
