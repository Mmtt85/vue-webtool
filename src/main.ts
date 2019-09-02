import Vue from 'vue';
import BootstrapVue from 'bootstrap-vue';
import VueApollo from 'vue-apollo';

import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faHome,
  faSignInAlt,
  faSignOutAlt
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

import 'bootstrap/dist/css/bootstrap.css';
import 'bootstrap-vue/dist/bootstrap-vue.css';

import apolloProvider from './configuration/apollo-config';
import router from './router';
import store from './store';

import App from './App.vue';

library.add(faHome, faSignInAlt, faSignOutAlt);
Vue.component('font-awesome-icon', FontAwesomeIcon);

Vue.config.productionTip = false;

Vue.use(BootstrapVue);
Vue.use(VueApollo);

new Vue({
  router,
  store,
  apolloProvider,
  render: h => h(App)
}).$mount('#app');
