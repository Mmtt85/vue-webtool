<template>
  <div class="login">
    <div role="group">
      <label for="input-id">ID</label>
      <b-form-input
        id="input-id"
        type="text"
        v-model="form.id"
        required
        autofocus
        aria-describedby="input-live-help input-live-feedback"
        placeholder="Enter your ID"
        trim
      />
      <b-form-invalid-feedback id="input-live-feedback">
        Enter at least 3 letters
      </b-form-invalid-feedback>
      <label for="input-password">Password</label>
      <b-form-input
        id="input-password"
        type="password"
        v-model="form.password"
        required
      />
      <b-button type="submit" @click="onSubmit" variant="outline-success"
        >Login</b-button
      >
    </div>
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import { Auth } from '@/interfaces/auth';
import Component from 'vue-class-component';

@Component({})
export default class Login extends Vue {
  public show: boolean = true;
  public form: Auth = { id: '', password: '', msg: '' };

  public onSubmit() {
    const { form, $router } = this;

    if (form.id && form.password) {
      if (form.id === 'root') $router.push('/home');
      else {
        form.msg = 'Invalid ID or Password';
      }
    }
  }
  // public isValidId = this.form.id.length > 2;
}
</script>

<style scoped></style>
