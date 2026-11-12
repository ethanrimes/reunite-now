param location string = resourceGroup().location
param prefix string = 'reunite-now'
param suffix string = '9a04'
@secure()
param databasePassword string
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
 name: '${prefix}-plan'
 location: location
 kind: 'linux'
 sku: {name:'B1',tier:'Basic',capacity:1}
 properties: {reserved:true}
}
resource web 'Microsoft.Web/sites@2023-12-01' = {
 name:'${prefix}-${suffix}'
 location:location
 kind:'app,linux'
 identity:{type:'SystemAssigned'}
 properties:{
  serverFarmId:plan.id
  httpsOnly:true
  siteConfig:{linuxFxVersion:'NODE|24-lts',alwaysOn:true,ftpsState:'Disabled',minTlsVersion:'1.2',http20Enabled:true,healthCheckPath:'/api/health',appCommandLine:'node dist/server.js'}
 }
}
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
 name:'${prefix}-pg-${suffix}'
 location:location
 sku:{name:'Standard_B1ms',tier:'Burstable'}
 properties:{
  version:'16'
  administratorLogin:'reunite_admin'
  administratorLoginPassword:databasePassword
  storage:{storageSizeGB:32,autoGrow:'Disabled'}
  backup:{backupRetentionDays:7,geoRedundantBackup:'Disabled'}
  highAvailability:{mode:'Disabled'}
  network:{publicNetworkAccess:'Enabled'}
  authConfig:{passwordAuth:'Enabled',activeDirectoryAuth:'Disabled'}
 }
}
resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
 parent:postgres
 name:'reunite_now'
 properties:{charset:'UTF8',collation:'en_US.utf8'}
}
resource communication 'Microsoft.Communication/communicationServices@2023-04-01' = {
 name:'${prefix}-communication'
 location:'global'
 properties:{dataLocation:'United States'}
}
output appName string = web.name
output appUrl string = 'https://${web.properties.defaultHostName}'
output databaseHost string = postgres.properties.fullyQualifiedDomainName
output communicationName string = communication.name
output principalId string = web.identity.principalId
