import { mount } from 'svelte';
import App from './ui/App.svelte';
import './ui/global.css';

const target = document.getElementById('app');
if (!target) {
  throw new Error('#app が見つかりません');
}

export default mount(App, { target });
