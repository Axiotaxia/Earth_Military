import { Shield, Lock } from 'lucide-react';

export function Privacy() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-300">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-600 to-green-900 flex items-center justify-center ring-2 ring-amber-600/30">
            <Shield className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-amber-400" style={{ fontFamily: 'Cinzel, serif' }}>
              Privacy Policy
            </h1>
            <p className="text-stone-500 text-sm">Earth Kingdom Military Command</p>
          </div>
        </div>

        <div className="ek-panel p-8 space-y-6 leading-relaxed">
          <Section title="1. Information We Collect">
            <p className="mb-2">When you sign in with Roblox OAuth, we collect:</p>
            <ul className="list-disc list-inside space-y-1 text-stone-400">
              <li><strong>Roblox User ID</strong> — your unique numeric identifier</li>
              <li><strong>Roblox Username & Display Name</strong> — for display purposes</li>
              <li><strong>Roblox Avatar URL</strong> — your profile picture</li>
              <li><strong>Group Rank</strong> — your current rank in the TSB Earth group</li>
              <li><strong>Timezone</strong> — your selected timezone for scheduling</li>
              <li><strong>Selected Path & Main Sub</strong> — your military specialization choices</li>
              <li><strong>Activity Data</strong> — login events and feature usage for analytics</li>
              <li><strong>Military Points</strong> — awards and deductions with reasons</li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul className="list-disc list-inside space-y-1 text-stone-400">
              <li>To authenticate your identity and determine access levels</li>
              <li>To display your military profile to other group members</li>
              <li>To manage divisions, ranks, promotions, and military points</li>
              <li>To generate HR analytics about group activity and engagement</li>
              <li>To improve the Service and its features</li>
            </ul>
          </Section>

          <Section title="3. Data Visibility">
            Your profile information (name, avatar, group rank, division, division rank, military points, timezone, path, main sub) is visible to other authenticated members of the Earth Kingdom military system. Activity analytics are visible to authorized HR personnel only.
          </Section>

          <Section title="4. Data Security">
            <ul className="list-disc list-inside space-y-1 text-stone-400">
              <li>We do not store your Roblox password — authentication is handled via OAuth tokens</li>
              <li>Row-level security policies protect data at the database level</li>
              <li>Permission-based access controls limit administrative actions</li>
              <li>Point transactions are immutable for audit integrity</li>
            </ul>
          </Section>

          <Section title="5. Third-Party Services">
            This Service integrates with Roblox via OAuth 2.0. Your use of Roblox is subject to Roblox's Terms of Service and Privacy Policy. We do not share your data with any other third parties.
          </Section>

          <Section title="6. Data Retention">
            Your data is retained while you are a member of the Earth Kingdom military system. Point transactions and activity logs are kept permanently for historical and audit purposes.
          </Section>

          <Section title="7. Your Rights">
            You may update your timezone, selected path, and main sub at any time through your profile. To request data deletion, contact the site owner.
          </Section>

          <Section title="8. Cookies and Local Storage">
            The Service uses local storage to maintain your login session. No tracking cookies are used.
          </Section>

          <Section title="9. Contact">
            For privacy concerns, contact the site owner (Roblox User ID: 593587739) through the Roblox group.
          </Section>
        </div>

        <div className="text-center mt-6">
          <a href="/" className="text-amber-500 hover:text-amber-400 text-sm">Back to Home</a>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-green-400 mb-2 flex items-center gap-2">
        <Lock className="w-4 h-4" />
        {title}
      </h2>
      <div className="text-sm text-stone-400">{children}</div>
    </div>
  );
}
