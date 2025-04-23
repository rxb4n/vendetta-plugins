import { findByProps } from "@vendetta/metro";
import { FluxDispatcher } from "@vendetta/metro/common";
import { after, before } from "@vendetta/patcher";
import { React } from "@vendetta/metro/common";
import { getAssetIDByName as getAssetId } from "@vendetta/ui/assets";
import { findInReactTree } from "@vendetta/utils";
import Settings from "./components/Settings";
import { storage } from "@vendetta/plugin";
import { logger } from "@vendetta";
import { RedesignRow } from "@nexpid/vdp-shared";

let patches = [];

const LazyActionSheet = findByProps("openLazy", "hideActionSheet");

function onLoad() {
    logger.log("HideMessages: Index at ", storage.hideMessagesIndex);
    patches.push(before("openLazy", LazyActionSheet, ([component, key, msg]) => {
        logger.log("ActionSheet key:", key, "Message:", !!msg?.message);
        const message = msg?.message;
        if (key !== "MessageLongPressActionSheet" || !message) return;
        component.then(instance => {
            if (!instance?.default) {
                logger.error("Failed to resolve ActionSheet component");
                return;
            }
            const unpatch = after("default", instance, (_, component) => {
                React.useEffect(() => () => unpatch(), []);
                logger.log("ActionSheet component:", component);
                const buttons = findInReactTree(component, x => x?.[0]?.type?.name === "ButtonRow");
                logger.log("Buttons found:", buttons);
                if (!buttons) return;

                const index = Math.min(storage.hideMessagesIndex || 2, buttons.length);
                buttons.splice(index, 0, (
                    <RedesignRow
                        label="Hide Message"
                        icon={getAssetId("ic_close_16px")}
                        onPress={() => {
                            logger.log("Dispatching MESSAGE_DELETE for message:", message.id);
                            FluxDispatcher.dispatch({
                                type: "MESSAGE_DELETE",
                                channelId: message.channel_id,
                                id: message.id,
                                __vml_cleanup: true,
                                otherPluginBypass: true
                            });
                            LazyActionSheet.hideActionSheet();
                        }}
                    />
                ));
            });
        }).catch(err => logger.error("Error loading ActionSheet:", err));
    }));
}

export default {
    onLoad,
    onUnload: () => {
        for (const unpatch of patches) unpatch();
    },
    settings: Settings
};
