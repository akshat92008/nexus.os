const fs = require('fs');

let content = fs.readFileSync('apps/web/components/workspace/ChiefOfStaffBriefing.tsx', 'utf8');

content = content.replace(
  /"Your 10:00 AM meeting with the venture team has been prepped with a 1-page summary of their latest fund performance\.[\s\S]*?I've also drafted follow-ups for the 12 non-critical emails received overnight, focusing on the Q3 partnership inquiries\."/,
  `&quot;Your 10:00 AM meeting with the venture team has been prepped with a 1-page summary of their latest fund performance.
            I&apos;ve also drafted follow-ups for the 12 non-critical emails received overnight, focusing on the Q3 partnership inquiries.&quot;`
);

fs.writeFileSync('apps/web/components/workspace/ChiefOfStaffBriefing.tsx', content);
