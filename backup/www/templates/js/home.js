/* vue obj list */
var navbar_vue_list = {};
var contents_vue_list = {};
var nav_vue_list = {};
var modal_vue_list = {};

/* calendar data */
var calendar_data = [
  { date: '2018-02-11', badge: false },
  { date: '2018-02-25', badge: false }
];
$(document).ready(function() {
  initVueObjects();

  initPage();
});

////////////////////////// INIT /////////////////////////
function initVueObjects() {
  makeNavbarInfoVueObj('span_navbar_info').change_message();
  makeContentsFooterVueObj('div_contents_footer');
  makeModalHdnVueObj('hdn_modal_result');
  makeModalBtnVueObj('btn_modal_ok');
  makeModalBtnVueObj('btn_modal_cancel');
  makeModalBtnVueObj('btn_modal_exit');
}

function initPage() {
  initCalendar();
  initPageEvents();
  initAnimateEvents();
}

function initAnimateEvents() {
  $('#div_contents_footer').C_AnimateCss('bounceInUp');
  $('#div_config').C_AnimateCss('bounceInUp');
}

function initPageEvents() {
  initNavbarMouseEvent();
  initNavbarLinkEvent();
}

function initCalendar() {
  initCalendarData();
  makeCalendar();
}

////////////////////////// VUE //////////////////////////
function makeNavbarInfoVueObj(el_id) {
  navbar_vue_list[el_id] = new Vue({
    el: '#' + el_id,
    data: {
      message: '',
      curr_config_idx: 0,
      change_term: 2,
      opacity: 1,
      transition: '',
      webkit_opacity: 1,
      webkit_transition: ''
    },
    methods: {
      make_message: function() {
        var $this = this;
        $this.opacity = 1;
        $this.webkit_opacity = 1;
        $this.transition = 'opacity .35s ease-in-out';
        $this.webkit_transition = 'opacity .35s ease-in-out';
        setTimeout(function() {
          $this.opacity = 0.1;
          $this.webkit_opacity = 0.1;
        }, $this.change_term * 1000 - 350);

        let all_config_key = Object.keys(global_config);
        let curr_config_key = all_config_key[$this.curr_config_idx];
        $this.message =
          curr_config_key + ' [ ' + global_config[curr_config_key] + ' ]';
        if ($this.curr_config_idx < all_config_key.length - 1) {
          $this.curr_config_idx += 1;
        } else {
          $this.curr_config_idx = 0;
        }
      },
      change_message: function(e) {
        var $this = this;
        $this.make_message();
        setInterval(function() {
          $this.make_message();
        }, $this.change_term * 1000);
      }
    }
  });
  return navbar_vue_list[el_id];
}

function makeContentsFooterVueObj(el_id) {
  contents_vue_list[el_id] = new Vue({
    el: '#' + el_id,
    data: { curr_year: new Date().getFullYear() },
    methods: {}
  });
}

/* modal windowの確認・取消ボタンでなにを押したか判断するため */
function makeModalHdnVueObj(el_id) {
  modal_vue_list[el_id] = new Vue({
    el: '#' + el_id,
    data: { result: false },
    methods: {}
  });
}

/* modal windowの確認・取消ボタン */
function makeModalBtnVueObj(el_id) {
  modal_vue_list[el_id] = new Vue({
    el: '#' + el_id,
    data: {},
    methods: {
      ok: function(event) {
        modal_vue_list['hdn_modal_result'].result = true;
      },
      cancel: function(event) {
        modal_vue_list['hdn_modal_result'].result = false;
      }
    }
  });
}

///////////////////////// EVENT /////////////////////////
function initNavbarLinkEvent() {
  $('#nav_home').on('click', function(e) {
    gotoHomePage();
  });
  $('#a_goto_c_md5sum_page').on('click', function(e) {
    gotoCMd5sumPage();
  });
  $('#a_goto_c_time_convert_page').on('click', function(e) {
    gotoCTimeConvertPage();
  });
  $('#a_goto_c_ssh_page').on('click', function(e) {
    gotoCSshPage();
  });
  $('#a_goto_c_text_convert_page').on('click', function(e) {
    gotoCTextConvertPage();
  });
  $('#a_goto_3_license_page').on('click', function(e) {
    goto3LicensePage();
  });
  $('#a_goto_3_copyto_page').on('click', function(e) {
    goto3CopytoPage();
  });
}

function initNavbarMouseEvent() {
  $('.nav-link.dropdown-toggle').on('click', function(e) {
    $.each(
      $(this)
        .parent()
        .siblings('li'),
      function(idx, d) {
        $(d)
          .children('div')
          .hide();
      }
    );
    if (
      $(this)
        .siblings('div')
        .is(':visible')
    ) {
      $(this)
        .siblings('div')
        .hide();
    } else {
      $(this)
        .siblings('div')
        .show();
    }
  });

  $('.nav-item.dropdown').hover(function(e) {
    $(this).toggleClass('bc-soft-primary');
  });

  $('.dropdown-item').on('click', function(e) {
    if (C_GetScreenSize() < 2) {
      $('#btn_navbar_toggle').click();
    }
    $(this)
      .parent('div')
      .hide();
  });
}

function initCalendarData() {
  var received_data = JSON.stringify(calendar_data);
}

function gotoHomePage() {
  window.location.href = '/home.html';
}

function gotoCMd5sumPage() {
  gotoPage('/common/md5sum.html');
}
function gotoCTimeConvertPage() {
  gotoPage('/common/time_convert.html');
}
function gotoCTextConvertPage() {
  gotoPage('/common/text_convert.html');
}
function gotoCSshPage() {
  gotoPage('/common/ssh.html');
}

function goto3LicensePage() {
  gotoPage('/3group/license.html');
}
function goto3CopytoPage() {
  gotoPage('/3group/copyto.html');
}

function gotoPage(url) {
  $('#div_contents_footer').C_AnimateCss('fadeOut');
  $('#div_contents_body').C_AnimateCss('fadeOut', function() {
    $('#div_contents_body').C_AnimateCss('zoomIn');
    $('#div_contents_footer').C_AnimateCss('bounceInUp');
    $('#div_config').C_AnimateCss('bounceInUp');
    $('#div_contents_body').load(url);
  });
}

function makeCalendar() {
  $('#div_contents_body').html("<div id='calendar'></div>");
  $('#calendar').zabuto_calendar({
    cell_border: true,
    today: true,
    show_days: true,
    weekstartson: 0,
    nav_icon: {
      prev: '<span class="ui-icon ui-icon-caret-1-w font-size-2"></span>',
      next: '<span class="ui-icon ui-icon-caret-1-e font-size-2"></span>'
    },
    data: calendar_data,
    action: function() {
      var date = $(this).data('date');

      C_OpenModalWindow(
        '<h4>修正 [ ' + date + ' ]</h4>',
        true,
        true,
        function() {
          sendJsonDataToDB(date);
          makeCalendar();
        }
      );

      $('#modal_body').load('/modal_window.html');
    }
  });
}

function sendJsonDataToDB(date) {
  calendar_data.push({ date: date, badge: false });
  var send_data = JSON.stringify(calendar_data);
}
