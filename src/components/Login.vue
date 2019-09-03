<template>
  <portal to="modals">
    <b-modal id="login-modal" @show="resetModal">
      <template slot="modal-title">
        Login
      </template>
      <div role="group" class="w-75 mx-auto">
        <label for="input-id">ID</label>
        <b-form-input
          id="input-id"
          type="text"
          class="mb-3"
          v-model="form.id"
          autofocus
          aria-describedby="input-live-help input-live-feedback"
          placeholder="Enter your ID"
          trim
        />
        <label for="input-password">Password</label>
        <b-form-input
          id="input-password"
          type="password"
          v-model="form.password"
          required
        />
      </div>
      <template slot="modal-footer" class="">
        <span class="text-right mr-4"
          >id: root<br />
          password: root</span
        >
        <b-button @click="login" variant="outline-success">Login</b-button>
      </template>
    </b-modal>
  </portal>
</template>

<script lang="ts">
import { Auth } from '@/interfaces/auth';
import { Component, Vue } from 'vue-property-decorator';
import { Portal } from 'portal-vue';
@Component({
  components: {
    Portal
  }
})
export default class Login extends Vue {
  public form: Auth = { id: '', password: '', msg: '' };
  public resetModal() {
    this.form = { id: '', password: '', msg: '' };
  }
  public login() {
    const { form, $store, $bvModal, $bvToast } = this;

    if (form.id === 'root' && form.password === 'root') {
      $store.commit('login', { id: form.id });
      $bvModal.hide('login-modal');
      $bvToast.toast('Success', {
        title: 'Login Success',
        variant: 'success',
        toaster: 'b-toaster-top-right',
        autoHideDelay: 500,
        toastClass: 'text-center'
      });
    } else {
      form.msg = 'Invalid ID or Password';
      $bvToast.toast(form.msg, {
        title: 'Failure',
        variant: 'danger',
        toaster: 'b-toaster-top-right',
        autoHideDelay: 2000,
        toastClass: 'text-center'
      });
    }
  }
}
</script>

<style scoped></style>
