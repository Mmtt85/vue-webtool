var day_obj = { 1: '月', 2: '火', 3: '水', 4: '木', 5: '金', 6: '土', 7: '日' };

/* vue obj list */
var table_vue_list = {};
var btn_vue_list = {};
var time_convert_vue_list = {};

$(document).ready(function() {
  initVueObjects();

  initPage();
});

/////////////////////////// INIT ///////////////////////////
function initVueObjects() {
  /* time convert group vue objs */
  makeTimeConvertIptVueObj('ipt_time_convert');
  makeTimeConvertBtnVueObj('btn_time_convert');
  makeTimeConvertSpanVueObj('span_time_convert');

  /* time table vue obj */
  makeTableTrVueObj('table_tr').init();

  /* refresh btn vue obj */
  makeRefreshBtnVueObj('btn_refresh');
}

function initPage() {
  initPageEvents();
}

function initPageEvents() {
  /* in common.js */
  C_SelectValueOfClickInputInThisPage();
}

//////////////////////////// VUE ////////////////////////////
/* vue object for time convert input element */
function makeTimeConvertSpanVueObj(el_id) {
  time_convert_vue_list[el_id] = new Vue({
    el: '#' + el_id,
    data: {
      result: new Date(
        time_convert_vue_list['ipt_time_convert'].value
      ).getTime()
    },
    methods: {}
  });

  return time_convert_vue_list[el_id];
}

/* vue object for time convert input element */
function makeTimeConvertBtnVueObj(el_id) {
  time_convert_vue_list[el_id] = new Vue({
    el: '#' + el_id,
    data: {},
    methods: {
      toggleDate: function() {
        $from = time_convert_vue_list['ipt_time_convert'];
        $target = time_convert_vue_list['span_time_convert'];

        if ($from.value.length === 0) {
          $target.result = 'Invaid data.';
        } else if (C_IsNum($from.value)) {
          if ($from.value.length == 13) {
            $target.result = C_DateToString(new Date(parseInt($from.value)));
          } else if ($from.value.length == 10) {
            $target.result = C_DateToString(
              new Date(parseInt($from.value + '000'))
            );
          }
        } else {
          $target.result = new Date($from.value).getTime().toString();
        }
      }
    }
  });

  return time_convert_vue_list[el_id];
}

/* vue object for time convert input element */
function makeTimeConvertIptVueObj(el_id) {
  time_convert_vue_list[el_id] = new Vue({
    el: '#' + el_id,
    data: { value: C_DateToString(new Date()) },
    methods: {}
  });

  return time_convert_vue_list[el_id];
}

/* vue object for table loop */
function makeTableTrVueObj(el_id) {
  table_vue_list[el_id] = new Vue({
    el: '#' + el_id,
    data: { dates: [] },
    methods: {
      init: function() {
        var $this = this;
        var jst_curr_date, gmt_curr_date;

        Module = {};

        /* wasm ファイルを特定タイミングでロードして、printfに対したマッピングメソッドであるModule["print"]をカスタマイズする */
        $.getScript('/common/wasm/getTime.js', function() {
          Module['print'] = function(text) {
            jst_curr_date = new Date(text);
            gmt_curr_date = new Date(text);
            gmt_curr_date.setFullYear(jst_curr_date.getUTCFullYear());
            gmt_curr_date.setMonth(jst_curr_date.getUTCMonth());
            gmt_curr_date.setDate(jst_curr_date.getUTCDate());
            gmt_curr_date.setHours(jst_curr_date.getUTCHours());

            $this.dates = [
              $this.makeData('JST', jst_curr_date),
              $this.makeData('GMT', gmt_curr_date)
            ];
          };
        });
      },
      makeData: function(type, dateObj) {
        return {
          type: type,
          day: day_obj[dateObj.getDay()],
          toString: C_DateToString(dateObj),
          obj: dateObj
        };
      }
    }
  });

  return table_vue_list[el_id];
}

/* refresh button vue object */
function makeRefreshBtnVueObj(el_id) {
  btn_vue_list[el_id] = new Vue({
    el: '#' + el_id,
    data: {},
    methods: {
      refresh: function(event) {
        table_vue_list['table_tr'].init();
      }
    }
  });

  return btn_vue_list[el_id];
}
