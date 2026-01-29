import React from 'react';
import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-gray-200 bg-white py-8 mt-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
        <p className="text-sm text-gray-400">
          {t('版权所有')} © 2025 {t('北京大学智慧城市实验室')} | yuq@pku.edu.cn
        </p>
        <img
          src="heading/heading.png"
          alt="heading"
          className="mt-3 mx-auto h-10 object-contain"
        />
      </div>
    </footer>
  );
}
