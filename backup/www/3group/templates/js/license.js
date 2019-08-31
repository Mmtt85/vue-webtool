/* vue obj list */
var div_vue_list = {};
var btn_vue_list = {};

$(document).ready(function() {
  initVueObjects();

  initPageEvents();
});

/////////////////////////// INIT ///////////////////////////
function initVueObjects() {
  div_list = [
    'div_ip_addr',
    'div_user_num',
    'div_expire_day',
    'div_p_type',
    'div_version'
  ];
  makeCommonVueObj(div_list);

  // get license button
  makeGetLicenseBtnVueObj('btn_get_license');

  // reset button
  makeResetBtnVueObj('btn_reset');
}

function initPageEvents() {
  /* in common.js */
  C_SelectValueOfClickInputInThisPage();
}

///////////////////////////// VUE /////////////////////////////
/* make common vue object */
function makeCommonVueObj(div_list) {
  $.each(div_list, function(i, el_id) {
    div_vue_list[el_id] = new Vue({
      el: '#' + el_id,
      data: {
        value: '',
        valid: 'is-valid',
        text_type: 'text-success',
        badge_state: 'badge-success',
        seen: false,
        message: ''
      },
      methods: {
        isNum: function(event) {
          var $this = this;
          while ($this.value.length > 1 && $this.value.charAt(0) === '0')
            $this.value = $this.value.substr(1);
          if (C_IsNum($this.value)) {
            $this.is_not_available = $this.seen = false;
            $this.valid = 'is-valid';
            $this.text_type = 'text-success';
            $this.badge_state = 'badge-success';
          } else {
            $this.message = '整数ではありません。';
            $this.is_not_available = $this.seen = true;
            $this.valid = 'is-invalid';
            $this.text_type = 'text-danger';
            $this.badge_state = 'badge-danger';
          }
        },
        checkIpAddr: function(event) {
          var $this = this;
          $this.is_not_available = false;

          var result = C_CheckTheIpAddr($this.value);

          var ip_addr_check_result = result.split(':')[0];
          var ip_addr_check_msg = result.split(':')[1];

          if (ip_addr_check_result > '0') {
            $this.message = ip_addr_check_msg;
            $this.is_not_available = true;
            $this.seen = true;
            $this.valid = 'is-invalid';
            $this.text_type = 'text-danger';
            $this.badge_state = 'badge-danger';
          } else {
            $this.seen = false;
            $this.valid = 'is-valid';
            $this.text_type = 'text-success';
            $this.badge_state = 'badge-success';
          }
        }
      }
    });
  });
}

/* get license button vue object */
function makeGetLicenseBtnVueObj(el_id) {
  btn_vue_list[el_id] = new Vue({
    el: '#' + el_id,
    data: {
      disabled: false,
      license_key: ''
    },
    methods: {
      getLicense: function() {
        var $this = this;
        var is_all_ok = true;
        $.each(div_vue_list, function(key, value) {
          if (value.seen) {
            is_all_ok = false;
            return false;
          }
        });

        if (is_all_ok === true) {
          var arg_list = [];
          C_OpenIptModalWindow(
            'データを渡す',
            'データ',
            'ipt_data',
            false,
            30,
            function() {
              arg_list = $('#ipt_data')
                .val()
                .split(',');

              /* loadingされたwasmファイルを初期化 */
              Module = {};

              /* wasm ファイルを特定タイミングでロードして、printfに対したマッピングメソッドであるModule["print"]をカスタマイズする */
              $.getScript('/3group/wasm/getLicense.js', function() {
                Module['arguments'] = arg_list;
                Module['print'] = function(text) {
                  C_OpenModalWindow('ライセンス', text, false, false, 30, null);
                };
              });
            }
          );
        } else {
          C_OpenAlertWindow(
            '入力値にミスがあります。',
            'alert-danger',
            30,
            2,
            2
          );
          return false;
        }
      }
    }
  });

  return btn_vue_list[el_id];
}

/* make reset button vue object */
function makeResetBtnVueObj(el_id) {
  btn_vue_list[el_id] = new Vue({
    el: '#' + el_id,
    data: {},
    methods: {
      reset: function() {
        goto3LicensePage();
      }
    }
  });

  return btn_vue_list[el_id];
}
