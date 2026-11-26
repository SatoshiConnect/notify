# SatoshiCore Notify - MikroTik WAN status example
#
# Before importing, replace both occurrences of:
#   nsat_REPLACE_WITH_BOT_KEY
#   REPLACE_WITH_NOTIFY_GROUP_ID
#
# Create one Bot in Notify and one recipient group (a one-person group is OK).
# This Netwatch probe checks reachability of 1.1.1.1 through the router's
# current routing table. It reports internet reachability, not Ethernet link state.

/system script add name="notify-wan-down" policy=read,write,test source={
    :local apiUrl "https://notify.satoshicore.org/api/integrations/notifications";
    :local botKey "nsat_REPLACE_WITH_BOT_KEY";
    :local groupId "REPLACE_WITH_NOTIFY_GROUP_ID";
    :local body ("{\"groupId\":\"" . $groupId . "\",\"title\":\"Internet DOWN\",\"body\":\"MikroTik cannot reach the internet probe 1.1.1.1.\",\"source\":\"MikroTik WAN\"}");
    :local headers ("Authorization: Bearer " . $botKey . ",Content-Type: application/json");
    :onerror err in={
        /tool fetch url=$apiUrl http-method=post http-header-field=$headers http-data=$body output=none check-certificate=yes;
    } do={
        :log error ("Notify WAN DOWN failed: " . $err);
        :error $err;
    };
    :log warning "Notify sent: Internet DOWN";
}

/system script add name="notify-wan-up" policy=read,write,test source={
    :local apiUrl "https://notify.satoshicore.org/api/integrations/notifications";
    :local botKey "nsat_REPLACE_WITH_BOT_KEY";
    :local groupId "REPLACE_WITH_NOTIFY_GROUP_ID";
    :local body ("{\"groupId\":\"" . $groupId . "\",\"title\":\"Internet restored\",\"body\":\"MikroTik can reach the internet probe 1.1.1.1 again.\",\"source\":\"MikroTik WAN\"}");
    :local headers ("Authorization: Bearer " . $botKey . ",Content-Type: application/json");
    :onerror err in={
        /tool fetch url=$apiUrl http-method=post http-header-field=$headers http-data=$body output=none check-certificate=yes;
    } do={
        :log error ("Notify WAN UP failed: " . $err);
        :error $err;
    };
    :log info "Notify sent: Internet restored";
}

/tool netwatch add name="Notify WAN" host=1.1.1.1 interval=30s timeout=3s down-script="/system script run notify-wan-down" up-script="/system script run notify-wan-up" comment="Notify on internet probe status changes"
