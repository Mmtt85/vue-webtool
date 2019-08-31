var md5sum_vue_list = [];
$(document).ready(function() {
  initVueObjects();

  initPage();
});

/////////////////////////// INIT ///////////////////////////
function initVueObjects() {
  makeFileVueObj('div_md5sum');
}

function initPage() {
  initPageEvents();
}

function initPageEvents() {
  /* in common.js */
  C_SelectValueOfClickInputInThisPage();
}

//////////////////////////// VUE ////////////////////////////
function makeFileVueObj(el_id) {
  md5sum_vue_list[el_id] = new Vue({
    el: '#' + el_id,
    data: {
      curr_progress: 0,
      results: ['結果出力'],
      value: '',
      width: '0%'
    },
    methods: {
      onChanged: function(e) {
        var $this = this;
        var file_list = $('#ipt_file_select')[0].files;
        var count_of_all_files = file_list.length;
        if (count_of_all_files > 0) {
          var num_of_curr_file = 0;
          $this.results = [];
          $('#progress_md5sum').css('width', '0');
          $this.curr_progress = 0;
          $.each(file_list, function(idx, file) {
            var fr = new FileReader();
            fr.readAsBinaryString(file);
            fr.onload = function(e) {
              if (e.target.readyState == FileReader.DONE) {
                // DONE == 2
                /* loadingされたwasmファイルを初期化 */
                // Module = {}

                /* wasm ファイルを特定タイミングでロードして、printfに対したマッピングメソッドであるModule["print"]をカスタマイズする */
                // $.getScript("/dutils/wasm/md5sum.js", function(){
                //   Module["arguments"] = [e.target.result];
                //   Module["print"] = function(text) {
                //     if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
                //     $this.results.push(text + " - " + file.name + " (" + file.size + " bytes)");
                //     num_of_curr_file += 1;
                //     var progress_percent = parseInt(num_of_curr_file * 100 / count_of_all_files);
                //     $("#progress_md5sum").css("width", progress_percent + "%");
                //     $this.curr_progress = progress_percent;
                //   }
                // });
                var bit128 = MD5_hash(e.target.result);
                var i, c;
                var hash = '';

                for (i = 0; i < 16; i++) {
                  c = bit128.charCodeAt(i);
                  hash += '0123456789abcdef'.charAt((c >> 4) & 0xf);
                  hash += '0123456789abcdef'.charAt(c & 0xf);
                }
                $this.results.push(
                  hash + ' - ' + file.name + ' (' + file.size + ' bytes)'
                );
                num_of_curr_file += 1;
                var progress_percent = parseInt(
                  (num_of_curr_file * 100) / count_of_all_files
                );
                $('#progress_md5sum').css('width', progress_percent + '%');
                $this.curr_progress = progress_percent;
              }
            };
          });
        }
      }
    }
  });
}
