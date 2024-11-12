import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import translation_en from './en.json';
 
 
const resources = {
  en: {
    translation: translation_en,
  },
};
 
// 进行初始化
i18n.use(initReactI18next).init({
  // 我们自己的语言文件
  resources,
  // 默认语言  zh/en  中文/英文
  lng: navigator.language === 'zh-CN'?'zh':'en',
  interpolation: {
    escapeValue: false,// 不会为了xss攻击，而把我们的内容强行转成字符串
  },
});

export default i18n;