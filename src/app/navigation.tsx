import { useMemo, useState } from "react";
import { useGameStore } from "../state/store";

type NavItem = {
  name: string;
  onClick: () => void;
};

type NavTopic = {
  name: string;
  onClick?: () => void;
  items?: NavItem[];
};

type NavSection = {
  title: string;
  onClick?: () => void;
  topics: NavTopic[];
};

export default function Navigation() {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [openTopics, setOpenTopics] = useState<Record<string, boolean>>({});

  const parties = useGameStore((s) => s.parties);
  const selectedPartyId = useGameStore((s) => s.selectedPartyId);

  const sendPartyToScene = useGameStore((s) => s.sendPartyToScene);
  const goToScene = useGameStore((s) => s.goToScene);

  const toggleTopic = (key: string) => setOpenTopics((prev) => ({ ...prev, [key]: !prev[key] }));

  // Choose which party to deploy when clicking "Hell"
  const partyToDeployId =
    selectedPartyId ??
    Object.keys(parties)[0] ??
    null;

  const navContent: NavSection[] = useMemo(() => {
    const goTown = () => goToScene("town");

    const goHell = () => {
      // Deploy party if we have one
      if (partyToDeployId) sendPartyToScene(partyToDeployId, "hell");
      goToScene("hell");
    };

    return [
      {
        title: "Town",
        onClick: goTown,
        topics: [
          { name: "Guild", onClick: () => console.log("Guild clicked") },
          { name: "Blacksmith", onClick: () => console.log("Blacksmith clicked") },
        ],
      },
      {
        title: "Adventures",
        topics: [
          {
            name: "Open World",
            items: [
              { name: "Hell", onClick: goHell },
              { name: "Forest", onClick: () => console.log("Open Forest scene") },
            ],
          },
          { name: "Dungeons", onClick: () => console.log("Dungeons clicked") },
          { name: "Raids", onClick: () => console.log("Raids clicked") },
        ],
      },
      {
        title: "Guild Members",
        topics: [
          { name: "Member List", onClick: () => console.log("Member List clicked") },
          { name: "Recruit", onClick: () => console.log("Recruit clicked") },
          { name: "Roles", onClick: () => console.log("Roles clicked") },
        ],
      },
      {
        title: "Quests",
        topics: [
          { name: "Quest 1", onClick: () => console.log("Quest 1 clicked") },
          { name: "Quest 2", onClick: () => console.log("Quest 2 clicked") },
          { name: "Quest 3", onClick: () => console.log("Quest 3 clicked") },
        ],
      },
    ];
  }, [goToScene, sendPartyToScene, partyToDeployId]);

  return (
    <div className="pointer-events-auto -mt-3 md:mt-3">
      <button
        className="absolute right-2 top-2 cursor-pointer rounded-lg border border-amber-100 bg-orange-500 px-2 pb-2 pt-1 text-sm text-white opacity-90"
        onClick={() => setNavigationOpen((v) => !v)}
        aria-label="Toggle navigation"
      >
        |||
      </button>

      {navigationOpen && (
        <div className="fixed right-0 top-0 h-dvh w-full bg-gray-600 p-2 md:absolute md:h-full md:w-40 md:rounded-br-2xl md:rounded-tr-2xl">
          <div className="flex flex-col gap-4">
            {navContent.map((section) => (
              <div key={section.title}>
                <button
                  type="button"
                  className="mb-1 w-full cursor-pointer rounded-md px-2 py-1 text-left text-sm font-semibold text-white/95 hover:bg-white/10"
                  onClick={section.onClick}
                >
                  {section.title}
                </button>

                <div className="flex flex-col gap-1">
                  {section.topics.map((topic) => {
                    const topicKey = `${section.title}/${topic.name}`;
                    const hasItems = !!topic.items?.length;
                    const isOpen = !!openTopics[topicKey];

                    return (
                      <div key={topicKey}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs text-white/90 hover:bg-white/10"
                          onClick={() => {
                            if (hasItems) toggleTopic(topicKey);
                            else topic.onClick?.();
                          }}
                        >
                          <span>{topic.name}</span>
                          {hasItems && <span className="text-white/70">{isOpen ? "▾" : "▸"}</span>}
                        </button>

                        {hasItems && isOpen && (
                          <div className="mt-1 flex flex-col gap-1 border-l border-white/10 pl-3">
                            {topic.items!.map((item) => (
                              <button
                                key={`${topicKey}/${item.name}`}
                                type="button"
                                onClick={item.onClick}
                                className="rounded-md px-2 py-1 text-left text-xs text-white/85 hover:bg-white/10"
                              >
                                {item.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <button
              className="mt-2 rounded-md border border-white/15 bg-white/10 px-2 py-1 text-xs text-white"
              onClick={() => setNavigationOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
