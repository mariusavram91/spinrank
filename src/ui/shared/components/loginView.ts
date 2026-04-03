import { bindLocalizedText } from "../i18n/runtime";

export interface LoginViewElements {
  loginView: HTMLElement;
  googleSlot: HTMLDivElement;
}

export const buildLoginView = (): LoginViewElements => {
  const loginView = document.createElement("section");
  loginView.className = "login-view";
  loginView.hidden = true;

  const loginWelcome = document.createElement("div");
  loginWelcome.className = "login-welcome";
  const loginTitle = document.createElement("h1");
  loginTitle.className = "login-title";
  bindLocalizedText(loginTitle, "loginTitle");
  const loginText = document.createElement("p");
  loginText.className = "login-text";
  bindLocalizedText(loginText, "loginText");
  loginWelcome.append(loginTitle, loginText);

  const googleContainer = document.createElement("div");
  googleContainer.className = "google-container";
  const googleSlot = document.createElement("div");
  googleSlot.className = "google-slot";
  googleContainer.append(googleSlot);

  loginView.append(loginWelcome, googleContainer);

  return {
    loginView,
    googleSlot,
  };
};
