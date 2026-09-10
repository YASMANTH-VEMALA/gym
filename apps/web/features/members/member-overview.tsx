import type { MemberDetail } from '@gym/types';
import { Card } from '@/components/ui/card';
import { memberAge, memberDate } from './member-shared';
export function MemberOverview({ member }: { member: MemberDetail }) {
  const sections: {
    title: string;
    fields: [string, string | number | null | undefined][];
  }[] = [
    {
      title: 'Personal Information',
      fields: [
        ['Name', member.fullName],
        ['Member Number', member.memberNumber],
        ['Phone', member.phone],
        ['Alternate Phone', member.alternatePhone],
        ['Email', member.email],
        ['Gender', member.gender],
        [
          'Date of Birth / Age',
          member.dateOfBirth
            ? `${memberDate(member.dateOfBirth)} · ${memberAge(member.dateOfBirth, member.business.timezone)} years`
            : null,
        ],
        ['Occupation', member.occupation],
      ],
    },
    {
      title: 'Address',
      fields: [
        ['Address Line 1', member.addressLine1],
        ['Address Line 2', member.addressLine2],
        ['City', member.city],
        ['State', member.state],
        ['PIN / Postal Code', member.postalCode],
        ['Country', member.country],
      ],
    },
    ...(member.emergencyContacts?.length
      ? member.emergencyContacts
      : member.emergencyContactName && member.emergencyContactPhone
        ? [
            {
              name: member.emergencyContactName,
              relationship: member.emergencyContactRelationship,
              phone: member.emergencyContactPhone,
            },
          ]
        : []
    ).map((contact, index) => ({
      title: `Emergency Contact ${index + 1}`,
      fields: [
        ['Name', contact.name],
        ['Relationship', contact.relationship],
        ['Phone', contact.phone],
      ] as [string, string | number | null | undefined][],
    })),
    {
      title: 'Fitness Information',
      fields: [
        ['Height', member.heightCm ? `${member.heightCm} cm` : null],
        [
          'Weight',
          member.weightGrams ? `${member.weightGrams / 1000} kg` : null,
        ],
        ['Goal', member.fitnessGoal],
      ],
    },
    {
      title: 'Other',
      fields: [
        ['Joining Date', memberDate(member.joiningDate)],
        ['Status', member.status],
        ['Notes', member.notes],
        ['Created', memberDate(member.createdAt, member.business.timezone)],
        ['Updated', memberDate(member.updatedAt, member.business.timezone)],
      ],
    },
  ];
  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      {sections.map((section) => (
        <Card className="min-w-0 p-6" key={section.title}>
          <h2>{section.title}</h2>
          <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
            {section.fields.map(([label, value]) => (
              <div className="min-w-0" key={label}>
                <dt className="text-slate-500">{label}</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words font-medium">
                  {value || '—'}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      ))}
    </div>
  );
}
