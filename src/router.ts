import Vue from 'vue';
import Router from 'vue-router';
import Main from './views/Main.vue';
import Index from './components/Index.vue';
import Base64 from './components/tools/Base64.vue';

Vue.use(Router);

export default new Router({
  mode: 'history',
  base: process.env.BASE_URL,
  routes: [
    {
      path: '/',
      name: 'main',
      component: Main,
      children: [
        {
          path: '/',
          name: 'home',
          component: Index
        },
        {
          path: 'base64',
          name: 'base64',
          component: Base64
        }
      ]
    }
  ]
});
