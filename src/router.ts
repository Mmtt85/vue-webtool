import Vue from 'vue';
import Router from 'vue-router';
import Main from '@/components/Main.vue';
import Index from '@/components/body/Home.vue';
import Base64 from '@/components/body/tools/Base64.vue';
import MakePassword from '@/components/body/tools/MakePassword.vue';
import JsonParser from '@/components/body/tools/JsonParser.vue';

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
        },
        {
          path: 'makePw',
          name: 'makePassword',
          component: MakePassword
        },
        {
          path: 'jsonParser',
          name: 'jsonParser',
          component: JsonParser
        }
      ]
    }
  ]
});
