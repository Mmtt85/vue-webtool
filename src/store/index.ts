import Vue from 'vue';
import Vuex from 'vuex';

import { Auth } from '@/interfaces/auth';

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
    auth: {
      id: '',
      msg: ''
    }
  },
  mutations: {
    login: (state, auth: Auth) => {
      state.auth.id = auth.id;
      if (auth.msg) state.auth.msg = auth.msg;
    },
    logout: state => {
      state.auth = { id: '', msg: 'logged out' };
    }
  },
  actions: {}
});
