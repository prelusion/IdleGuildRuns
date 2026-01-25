import { useMemo } from "react";
import { useGameStore } from "../state/store";
import { SCENES } from "../game/scenes/sceneRegistry";

export default function GuildPanel() {
  const guildMembers = useGameStore((s) => s.guildMembers);
  const parties = useGameStore((s) => s.parties);

  const createParty = useGameStore((s) => s.createParty);
  const addMemberToParty = useGameStore((s) => s.addMemberToParty);
  const removeMemberFromParty = useGameStore((s) => s.removeMemberFromParty);
  const sendPartyToScene = useGameStore((s) => s.sendPartyToScene);

  const members = useMemo(() => Object.values(guildMembers), [guildMembers]);
  const partyList = useMemo(() => Object.values(parties), [parties]);

  return (
    <div className="panel">
      <h2>Guild</h2>

      <div className="flex gap-2 mb-3">
        <button
          className="rounded-md border border-white/15 bg-white/10 px-2 py-1 text-xs text-white"
          onClick={() => createParty(`Party ${partyList.length + 1}`)}
        >
          + Party
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-sm font-semibold mb-2">Members</div>
          <div className="flex flex-col gap-2">
            {members.map((m) => (
              <div key={m.id} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
                <div className="flex justify-between">
                  <div className="font-semibold">{m.name} <span className="opacity-70">({m.role})</span></div>
                  <div className="opacity-70">{m.hp}/{m.maxHp}</div>
                </div>
                <div className="opacity-70 mt-1">
                  Scene: <b>{m.sceneId}</b> • Party: <b>{m.partyId ?? "-"}</b>
                </div>

                <div className="flex gap-2 mt-2 flex-wrap">
                  {partyList.map((p) => (
                    <button
                      key={p.id}
                      className="rounded-md border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white"
                      onClick={() => addMemberToParty(m.id, p.id)}
                    >
                      Add → {p.name}
                    </button>
                  ))}

                  {m.partyId && (
                    <button
                      className="rounded-md border border-red-400/30 bg-red-400/10 px-2 py-1 text-[11px] text-white"
                      onClick={() => removeMemberFromParty(m.id)}
                    >
                      Remove from party
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold mb-2">Parties</div>
          <div className="flex flex-col gap-2">
            {partyList.map((p) => (
              <div key={p.id} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
                <div className="flex justify-between">
                  <div className="font-semibold">{p.name}</div>
                  <div className="opacity-70">Scene: {p.sceneId}</div>
                </div>

                <div className="opacity-70 mt-1">
                  Members: {p.memberIds.length}
                </div>

                <div className="flex gap-2 mt-2 flex-wrap">
                  {Object.values(SCENES).map((s) => (
                    <button
                      key={s.id}
                      className="rounded-md border border-white/15 bg-white/10 px-2 py-1 text-[11px] text-white"
                      onClick={() => sendPartyToScene(p.id, s.id)}
                    >
                      Send → {s.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="text-[11px] opacity-70 mt-3 leading-relaxed">
        Parties deployed to a scene will spawn there automatically. Dead allies are recalled to Town after 60s.
      </div>
    </div>
  );
}
