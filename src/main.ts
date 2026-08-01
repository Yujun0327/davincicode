import { mount } from 'svelte'
import '@fontsource/saira-stencil-one/400.css'
import '@fontsource/courier-prime/400.css'
import '@fontsource/courier-prime/400-italic.css'
import '@fontsource/courier-prime/700.css'
import '@fontsource/archivo-narrow/500.css'
import '@fontsource/archivo-narrow/700.css'
import './app.css'
import App from './App.svelte'

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
