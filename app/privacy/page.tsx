import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden border border-slate-200">
        <div className="bg-emerald-600 px-8 py-10 text-white">
          <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-emerald-100 italic">Last updated: April 4, 2026</p>
        </div>
        
        <div className="px-8 py-10 space-y-8 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 border-b-2 border-emerald-100 pb-2 mb-4">1. Introduction</h2>
            <p>
              Welcome to <strong>Feed Reminder Up</strong>. We are committed to protecting your personal information and your right to privacy. 
              This Privacy Policy explains how we collect, use, and safeguard your data when you use our mobile application and related services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 border-b-2 border-emerald-100 pb-2 mb-4">2. Data We Collect</h2>
            <p>We may collect limited information to provide you with a better experience:</p>
            <ul className="list-disc ml-6 mt-4 space-y-2 text-slate-600">
              <li><strong>Poultry Management Data:</strong> Information about your bird counts, feed schedules, and performance metrics.</li>
              <li><strong>Device Information:</strong> Basic analytics about the device you use to access the app.</li>
              <li><strong>Local Storage:</strong> Some data may be stored locally on your device for offline access.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 border-b-2 border-emerald-100 pb-2 mb-4">3. How We Use Your Information</h2>
            <p>Your information is used solely for:</p>
            <ul className="list-disc ml-6 mt-4 space-y-2 text-slate-600">
              <li>Providing and maintaining the Feed Reminder Up service.</li>
              <li>Calculating feed requirements and performance reports.</li>
              <li>Improving app functionality and user experience.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 border-b-2 border-emerald-100 pb-2 mb-4">4. Data Sharing</h2>
            <p>
              We <strong>do not sell or share</strong> your personal data with third parties for marketing purposes. Data may only be shared 
              when required by law or to protect our rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 border-b-2 border-emerald-100 pb-2 mb-4">5. Security</h2>
            <p>
              We implement industry-standard security measures to protect your data. However, remember that no method of transmission 
              over the internet or electronic storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 border-b-2 border-emerald-100 pb-2 mb-4">6. Contact Us</h2>
            <p>
              If you have any questions or suggestions about our Privacy Policy, do not hesitate to contact us at:
            </p>
            <div className="mt-4 p-4 bg-emerald-50 rounded-lg border border-emerald-100 select-all">
              <p className="font-mono text-emerald-800">support@amiba.dev</p>
            </div>
          </section>
        </div>
        
        <div className="bg-slate-50 px-8 py-6 border-t border-slate-200 text-center text-slate-500 text-sm">
          &copy; 2026 Feed Reminder Up. All rights reserved.
        </div>
      </div>
    </div>
  );
}
