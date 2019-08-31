import Vue from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';

import BootstrapVue from 'bootstrap-vue';
import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue/dist/bootstrap-vue.css';
import VueApollo from 'vue-apollo';
import apolloProvider from './configuration/apollo-config';

Vue.config.productionTip = false;

Vue.use(VueApollo);
Vue.use(BootstrapVue);

new Vue({
  router,
  store,
  apolloProvider,
  render: h => h(App)
}).$mount('#app');
