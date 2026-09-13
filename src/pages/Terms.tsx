import { Shield, FileText } from 'lucide-react';

export function Terms() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-300">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-600 to-green-900 flex items-center justify-center ring-2 ring-amber-600/30">
            <Shield className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-amber-400" style={{ fontFamily: 'Cinzel, serif' }}>
              Terms of Service
            </h1>
            <p className="text-stone-500 text-sm">Earth Kingdom Military Command</p>
          </div>
        </div>

        <div className="ek-panel p-8 space-y-6 leading-relaxed">
          <Section title="1. Acceptance of Terms">
            By accessing and using the Earth Kingdom Military Command website ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.
          </Section>

          <Section title="2. Eligibility">
            You must have a valid Roblox account to use this Service. Your access level is determined by your rank within the TSB Earth Roblox group (Group ID: 592750791). Most features require a rank of Private or higher.
          </Section>

          <Section title="3. Authentication">
            The Service uses Roblox OAuth 2.0 for authentication. We request access to your Roblox profile information (username, display name, avatar) and your group membership status. We do not store your Roblox password.
          </Section>

          <Section title="4. User Conduct">
            <ul className="list-disc list-inside space-y-1 text-stone-400">
              <li>You agree not to abuse the point system, promotion system, or any other feature.</li>
              <li>You agree not to attempt to access features beyond your permission level.</li>
              <li>You agree not to harass or misuse other members' profile information.</li>
              <li>Division leaders and officers are responsible for fair and accurate management.</li>
            </ul>
          </Section>

          <Section title="5. Data Usage">
            Information collected (timezone, selected path, main sub, military points, activity) is used solely for managing the Earth Kingdom military structure. Your data is visible to other group members as part of the military management system.
          </Section>

          <Section title="6. Permissions and Roles">
            Permissions (division creation, rank creation, promotions, point awards, HR panel access) are granted by the site owner or division leadership. The site owner (Roblox User ID: 593587739) has full administrative control.
          </Section>

          <Section title="7. Points and Promotions">
            Military points are awarded based on documented events (raids, trainings, recruiting, etc.). Points are tracked permanently for audit purposes. Promotions are managed by authorized personnel and apply only to non-Roblox ranks within the division system.
          </Section>

          <Section title="8. Changes to Terms">
            We reserve the right to update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the new Terms.
          </Section>

          <Section title="9. Disclaimer">
            This Service is a fan-made tool for the Avatar: The Last Airbender-themed Roblox group. It is not affiliated with or endorsed by Roblox Corporation or Nickelodeon.
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
        <FileText className="w-4 h-4" />
        {title}
      </h2>
      <div className="text-sm text-stone-400">{children}</div>
    </div>
  );
}
