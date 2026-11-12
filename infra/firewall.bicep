param serverName string = 'reunite-now-pg-9a04'
param outboundIps array
resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' existing = {name:serverName}
resource rules 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = [for (ip,i) in outboundIps: {
 parent:server
 name:'app-outbound-${i}'
 properties:{startIpAddress:ip,endIpAddress:ip}
}]
