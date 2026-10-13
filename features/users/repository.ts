import "server-only";
import { cloudEnabled, rest } from "@/lib/supabase/client";
import { readStore, updateStore, type LocalMember } from "@/lib/local-store";
import { eq, write } from "@/lib/supabase/queries";
export async function getMember(
  username: string,
): Promise<LocalMember | undefined> {
  if (!cloudEnabled())
    return (await readStore()).members.find((m) => m.email === username);
  return (
    await rest<LocalMember[]>(
      "configor_members",
      "email=" + eq(username) + "&limit=1",
    )
  )[0];
}

export async function listMembers() {
  if (!cloudEnabled())
    return (await readStore()).members.map(({ passwordHash, ...m }) => m);
  return rest<Omit<LocalMember, "passwordHash">[]>(
    "configor_members",
    "select=email,name,role,active&order=name",
  );
}

export async function saveMember(member: LocalMember, revoke: boolean) {
  if (!cloudEnabled())
    return updateStore((s) => {
      const i = s.members.findIndex((m) => m.email === member.email);
      if (i < 0) s.members.push(member);
      else s.members[i] = member;
      if (revoke)
        s.sessions = s.sessions.filter((x) => x.email !== member.email);
    });
  await rest(
    "rpc/configor_save_member",
    "",
    write({ p_member: member, p_revoke: revoke }),
  );
}
