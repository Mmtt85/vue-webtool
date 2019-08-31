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

  makePreCliResult('pre_cli_command_result');
  makePreCliResult('pre_cli_script_result');
  makeBtnCliExecute(
    'btn_command_execute',
    'ipt_cli_command',
    'pre_cli_command_result'
  );
  makeBtnCliExecute(
    'btn_script_execute',
    'txt_cli_script',
    'pre_cli_script_result'
  );
  makeBtnCliExecute(
    'btn_command_clear',
    'ipt_cli_command',
    'pre_cli_command_result'
  );
  makeBtnCliExecute(
    'btn_script_clear',
    'txt_cli_script',
    'pre_cli_script_result'
  );
  makeIptCliCommand('ipt_cli_command');
  makeTxtCliScript('txt_cli_script');

  ssh_target_vue_list['btn_prompt'] = new Vue({
    el: '#btn_prompt',
    data: {
      value:
        '[ ' +
        ssh_target_vue_list['ipt_target_server'].value +
        '@' +
        ssh_target_vue_list['ipt_account_name'].value +
        ' ] $ '
    },
    methods: {}
  });
}

function initPage() {
  initPageEvents();
}

function initPageEvents() {
  /* in common.js */
  C_SelectValueOfClickInputInThisPage();
}

///////////////////// VUE /////////////////////
/* ssh command/scriptを実行した結果を表示するためのvue objs */
function makePreCliResult(el_id) {
  ssh_cli_execute_vue_list[el_id] = new Vue({
    el: '#' + el_id,
    data: { result: 'result output' },
    methods: {}
  });
}

/* ssh command/script を実行するボタンの vue objs */
function makeBtnCliExecute(el_id, cli_data_el_id, cli_result_el_id) {
  ssh_cli_execute_vue_list[el_id] = new Vue({
    el: '#' + el_id,
    methods: {
      execute: function() {
        var cli_data = ssh_cli_execute_vue_list[cli_data_el_id].value;

        sshExecute(cli_data, function(result) {
          ssh_cli_execute_vue_list[cli_result_el_id].result = result;
        });
      },
      clear: function() {
        ssh_cli_execute_vue_list[cli_result_el_id].result = 'result output\n';
      }
    }
  });
}

/* ssh command 入力input text */
function makeIptCliCommand(el_id) {
  ssh_cli_execute_vue_list[el_id] = new Vue({
    el: '#' + el_id,
    data: { value: '' },
    methods: {
      onKeyUp: function(event) {
        if (event.key === 'Enter' || event.keyCode === 13) {
          ssh_cli_execute_vue_list['btn_command_execute'].execute();
        }
      }
    }
  });
}

/* ssh script 入力text area */
function makeTxtCliScript(el_id) {
  ssh_cli_execute_vue_list[el_id] = new Vue({
    el: '#' + el_id,
    data: { value: '' },
    methods: {
      onKeyUp: function(event) {
        if (
          (event.metaKey || event.ctrlKey) &&
          (event.key === 'Enter' || event.keyCode === 13)
        ) {
          ssh_cli_execute_vue_list['btn_script_execute'].execute();
        }
      }
    }
  });
}

/* ターゲットサーバーに対する情報入力エレメントのvue objs */
function makeSshTargetIptVueObj(el_id) {
  ssh_target_vue_list[el_id] = new Vue({
    el: '#' + el_id,
    data: { value: '' }
  });

  return ssh_target_vue_list[el_id];
}

//////////////////////// COMMON ////////////////////////
function getSshTargetInfo() {
  return {
    target_server: ssh_target_vue_list['ipt_target_server'].value,
    target_dir: ssh_target_vue_list['ipt_target_dir'].value,
    account_name: ssh_target_vue_list['ipt_account_name'].value,
    account_password: ssh_target_vue_list['ipt_account_password'].value
  };
}

/* cli commandを対象サーバーで実行 */
function sshExecute(cli_command, success_func) {
  var ajax_data = getSshTargetInfo();
  ajax_data['cli_command'] = cli_command;

  $.ajax({
    url: api_server + '/api_ssh/execute_cli_command',
    type: 'post',
    data: { json_ajax_data: JSON.stringify(ajax_data) },
    dataType: 'json',
    success: function(result) {
      if (typeof success_func === 'function') {
        success_func(result);
      }
    }
  });
}
