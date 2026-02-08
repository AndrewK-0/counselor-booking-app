declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'express-session' {
  interface SessionData {
    user?: {
      id: number
      username: string
    }
    ua?: string
  }
}
