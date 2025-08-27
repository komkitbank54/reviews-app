/// <reference types="next" />
declare namespace NodeJS {
  interface ProcessEnv {
    MONGODB_URI: string;
    MONGODB_DB?: string;
    ADMIN_TOKEN?: string;
  }
}
