var alert_vue_obj = {};

//////////////// INIT ////////////////
$(document).ready(function() {
  makeAlertWindowVueObj();
  makeCopyToClipboard();
  registVueComponents();
});

////////////////////////// COMMON UTILITIES //////////////////////////
/* number type checking */
function C_IsNum(string) {
  if (typeof string === 'number') return true;

  while (string.charAt(0) === '0') string = string.substr(1);

  if (string.length !== 0 && parseInt(string).toString() !== string)
    return false;
  return true;
}

/* date object → 「 YYYY/MM/DD hh:mm:ss 」形に変更 */
function C_DateToString(dateObj) {
  return (
    dateObj.getFullYear() +
    '-' +
    C_Pad(dateObj.getMonth() + 1, 2) +
    '-' +
    C_Pad(dateObj.getDate(), 2) +
    ' ' +
    C_Pad(dateObj.getHours(), 2) +
    ':' +
    C_Pad(dateObj.getMinutes(), 2) +
    ':' +
    C_Pad(dateObj.getSeconds(), 2)
  );
}

/* 0埋め、str: 対象文字列, width: 桁数, z: 埋める文字 */
function C_Pad(str, width, z = '0') {
  str = str + '';
  return str.length >= width
    ? str
    : new Array(width - str.length + 1).join(z) + str;
}

/* このページのすべてのinput elementに対して、クリックしたとき中身を全部選択 */
function C_SelectValueOfClickInputInThisPage() {
  $.each($('input[type=text], input[type=password]'), function() {
    C_SelectValueOfClickInputInThisElement(this);
  });
}

/* このinput elementに対して、クリックしたとき中身を全部選択 */
function C_SelectValueOfClickInputInThisElement(el) {
  $(el).on('click', function() {
    $(el)[0].setSelectionRange(0, $(el).val().length);
  });
}

/* IPADDRの形式をチェック */
function C_CheckTheIpAddr(ip_addr_str) {
  if (ip_addr_str === '') {
    result = '9:値がありません。';
  } else {
    ip_addrs = ip_addr_str.split('.');
    result = '0:OK';
    if (ip_addrs.length < 4) {
      result = '1:IPアドレスの形が間違っています。';
    } else {
      $.each(ip_addrs, function(idx, val) {
        if (val === '') {
          result = '1:IPアドレスの形が間違っています。';
        } else if (val.length > 3) {
          result = '2:IPアドレスは 3桁を超えることができません。';
        } else if (val.length > 1 && val[0] === '0') {
          result = '3:IPアドレスは 0から始まることができません。';
        } else if (parseInt(val).toString() !== val) {
          result = '4:IPアドレスには数字だけ入力してさい。';
        } else if (parseInt(val) > 255 || parseInt(val) < 0) {
          result = '5:IPアドレスは 0 ~ 255の値を入力してください。';
        } else if (idx === 0 && val === '0') {
          result = '6:IPアドレスの1番目は0になりません。';
        }
      });
    }
  }

  return result;
}

/* wrapping method */
function C_OpenIptModalWindow(
  modal_title,
  ipt_title,
  ipt_id,
  is_large,
  top,
  func_when_hidden_as_yes
) {
  C_OpenModalWindow(
    "<span class='ui-icon ui-icon-circle-check mr-1'></span><span class='align-middle'>" +
      modal_title +
      '</span>',
    "<div class='input-group mb-2 p-0'><span class='input-group-btn'><button class='btn btn-info right-no-radius pt-1 pb-1' type='button' disabled>" +
      ipt_title +
      '</button></span><input id=' +
      ipt_id +
      " class='form-control pt-1 pb-1'></div>",
    true,
    is_large,
    top,
    func_when_hidden_as_yes
  );
}

/* modal window */
function C_OpenModalWindow(
  title,
  body = null,
  yes_btn = true,
  is_large = true,
  top = 40,
  func_when_hidden_as_yes = null
) {
  $('#modal_title').html("<h5 class='m-0'>" + title + '</h5>');

  if (body) {
    $('#modal_body').html(body);
  } else if (body === null) {
    $('#modal_body').html(
      "<img id='img_loader' class='m-3' src='/templates/images/loader.gif'>"
    );
  }

  if (yes_btn === true) {
    $('#btn_modal_ok').show();
  } else {
    $('#btn_modal_ok').hide();
  }

  if (is_large === true) {
    $('#modal_dialog')
      .removeClass('modal-lg')
      .addClass('modal-lg');
  } else {
    $('#modal_dialog').removeClass('modal-lg');
  }

  $('#contents_modal').modal({ show: true, backdrop: 'static' });

  $('#contents_modal').css('top', top + 'vh');
  if (
    func_when_hidden_as_yes !== null &&
    typeof func_when_hidden_as_yes === 'function'
  ) {
    $('#contents_modal').off('hidden.bs.modal');
    $('#contents_modal').on('hidden.bs.modal', function() {
      if (modal_vue_list['hdn_modal_result'].result === true) {
        func_when_hidden_as_yes();
      }
    });
  }
}

/* alert vue objのopenWindowメソッドを実行 */
/* alert_class: "bootstrap4 alerts color"をググる */
/* top_position: n%, width: max 12, time_term: n seconds */
function C_OpenAlertWindow(
  content,
  alert_class = 'alert-success',
  top_position = 40,
  width = 4,
  time_term = 1.5
) {
  alert_vue_obj.openWindow(
    content,
    alert_class,
    top_position,
    width,
    time_term
  );
}

/* スクリーンの大きさを判別 */
function C_GetScreenSize() {
  var winWidth = $(window).width();
  var result = 0;
  if (winWidth < 576) {
    result = 0;
  } else if (winWidth < 768) {
    result = 1;
  } else if (winWidth < 992) {
    result = 2;
  } else if (winWidth < 1200) {
    result = 3;
  } else {
    result = 4;
  }
  return result;
}

/* checkboxをカスタマイズ */
function C_ConvertCheckbox() {
  $('input').iCheck({
    checkboxClass: 'icheckbox_flat',
    radioClass: 'iradio_flat',
    increaseArea: '20%' // optional
  });
}

/* 該当elementを覆うoverlayを作り出す */
function C_MakeOverlay(element) {
  $overlay = $("<div id='overlay_" + $(element).attr('id') + "' />");
  $overlay.css({
    position: 'absolute',
    top: 0,
    left: 0,
    width: $(element).width(),
    height: $(element).height(),
    zIndex: 10000,
    // IE needs a color in order for the layer to respond to mouse events
    'background-color': '#fff',
    opacity: 0
  });

  return $overlay;
}

/* animateCssのため */
$.fn.extend({
  C_AnimateCss: function(animationName, callback) {
    var animationEnd = (function(el) {
      var animations = {
        animation: 'animationend',
        OAnimation: 'oAnimationEnd',
        MozAnimation: 'mozAnimationEnd',
        WebkitAnimation: 'webkitAnimationEnd'
      };

      for (var t in animations) {
        if (el.style[t] !== undefined) return animations[t];
      }
    })(document.createElement('div'));
    this.removeClass('animated ' + animationName);
    this.addClass('animated ' + animationName).one(animationEnd, function() {
      $(this).removeClass('animated ' + animationName);
      if (typeof callback === 'function') callback();
    });

    return this;
  }
});

////////////////////// PRIVATE METHODS //////////////////////
/* アラートウィンドウのVue オブジェクトを生成 */
function makeAlertWindowVueObj() {
  $('#div_alert').css('top', '100%');
  alert_vue_obj = new Vue({
    el: '#div_alert',
    data: {
      alert_class: 'alert-primary',
      border_class: 'border-primary',
      col_md_class: 'col-md-4',
      offset_md_class: 'offset-md-4',
      show_class: false,
      text_center_class: false,
      title: '',
      open: 0
    },
    methods: {
      openWindow: function(title, alert_class, top_position, width, time_term) {
        var $this = this;

        $($this.$el).css('top', top_position + '%');

        $this.offset_md_class = 'offset-md-' + parseInt((12 - width) / 2);

        if (width > 3) {
          $this.text_center_class = false;
        } else {
          $this.text_center_class = true;
        }

        $this.show_class = true;

        $this.open += 1;
        $this.title = title;
        $this.alert_class = alert_class;
        $this.border_class = alert_class.replace('alert', 'border');
        $this.col_md_class = 'col-md-' + width;

        setTimeout(function() {
          $this.open -= 1;
          if ($this.open == 0) {
            $this.show_class = false;
            $($this.$el).css('top', '100%');
          }
        }, time_term * 1000);
      }
    }
  });
}

/* clipboardにコピーするライブラリのオブジェクトを生成 */
function makeCopyToClipboard() {
  var clipboard = new ClipboardJS('.copy-btn');
  clipboard.on('success', function(e) {
    e.clearSelection();
    C_OpenAlertWindow('コピー完了', 'alert-success', 40, 2, 2);
  });
}

/* template elementを登録する */
function registVueComponents() {
  Vue.component('copy-btn', {
    template:
      '<input class="btn btn-outline-secondary btn-sm insert-into-rb copy-btn m-3 mr-5" type="button" value="COPY">'
  });
}
