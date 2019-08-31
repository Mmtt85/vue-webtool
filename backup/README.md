# Centos 7.4 emcc環境構築
<pre>
linux version : CentOS Linux release 7.4.1708 (Core)
gcc version : 4.8.5 (package installed by groupinstall "Development Tools")
clang version : 5.0.0 (source installed by emsdk)
cmake version : 3.6.3 (package installed by install "cmake3")

# yum install epel-release -y
　→ cmake3をパッケージインストールするため
# yum groupinstall "Development Tools" -y
# yum install cmake3 wget -y
　→ emsdk latest sdkで使うclangはcmake 3.4.x 以上を求めます。
# cd /usr/bin; mv cmake cmake2; mv cpack cpack2; mv ctest ctest2; mv ccmake ccmake3;
# ln -s cmake3 cmake; ln -s cpack3 cpack; ln -s ctest3 ctest; ln -s ccmake3 ccmake;
# cd /opt
# wget https://s3.amazonaws.com/mozilla-games/emscripten/releases/emsdk-portable.tar.gz
# tar xvzf emsdk-portable.tar.gz
# cd emsdk-portable
# ./emsdk update
# ./emsdk install latest; 
　→ 最新バージョンのsdkをダウンロード
# ./emsdk activate latest
　→ ダウンロードした最新バージョンのsdkを活性化
# ./emsdk install clang-incoming-64bit; ./emsdk activate clang-incoming-64bit
　→ 最新バージョンのsdkが使ってるclangはglibcxx-3.4.21を求めますが、centos7は3.4.19までしかないので
　　インストールできるバージョンのclangを自動に探してインストールしてくれます。（1時間ほどかかります。）
# source ./emsdk_env.sh
　→ 毎度インポートするべきなので/etc/profileなどに…
# yum install java
　→ jdk インストール
# emcc
　→ 最初実行時は時間が少しかかります。
</pre>

# ubuntu 16.04.3 emcc環境構築
<pre>
gcc version 5.4
clang version 4.0.0

# cd /opt
# wget https://s3.amazonaws.com/mozilla-games/emscripten/releases/emsdk-portable.tar.gz
# tar xvzf emsdk-portable.tar.gz
# ./emsdk update
# ./emsdk install latest
# ./emsdk activate latest
# source ./emsdk_env.sh
# emcc
</pre>