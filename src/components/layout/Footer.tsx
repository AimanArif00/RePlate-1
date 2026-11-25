interface FooterProps {
  contactEmail?: string;
  onNavigate: (path: string) => void;
}

export function Footer({
  contactEmail = 'support@replatecampus.edu.my',
  onNavigate,
}: FooterProps) {
  const link = (path: string, label: string) => (
    <a
      href={path}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(path);
      }}
      className="text-sm text-gray-600 hover:text-[#166534] transition-colors"
    >
      {label}
    </a>
  );

  return (
    <footer className="border-t border-[#E5EBE3] bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <p className="font-[var(--font-display)] text-lg font-bold text-[#166534]">
              RePlate Campus
            </p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-600">
              Save Food. Save Money. Save Our Planet. Connecting university cafeterias and cafes with
              students to rescue surplus meals in support of UN SDG 12.
            </p>
            <p className="mt-4 text-xs text-gray-500">
              Campus Support: <span className="font-medium text-[#1F2937]">{contactEmail}</span>
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#1F2937]">Platform</h3>
            <ul className="mt-3 space-y-2">
              <li>{link('/browse', 'Browse Food')}</li>
              <li>{link('/how-it-works', 'How It Works')}</li>
              <li>{link('/about', 'About RePlate & SDG 12')}</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#1F2937]">Get Started</h3>
            <ul className="mt-3 space-y-2">
              <li>{link('/register/student', 'Student Registration')}</li>
              <li>{link('/register/vendor', 'Vendor Registration')}</li>
              <li>{link('/login', 'Account Login')}</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-[#F0F4EE] pt-6 text-xs text-gray-500 sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} RePlate Campus. University Sustainability Initiative.</p>
          <p>Environmental savings are estimated from completed pickups.</p>
        </div>
      </div>
    </footer>
  );
}
