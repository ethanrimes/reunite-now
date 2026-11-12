// Prepare the branded sender. DNS verification and linking are separate steps.
// This template preserves the existing Azure-managed domain and Communication Service links.
param emailServiceName string = 'reunite-now-email'
param domainName string = 'visatransparency.org'
param senderName string = 'noreply'

resource email 'Microsoft.Communication/emailServices@2023-04-01' existing = {
  name: emailServiceName
}
resource domain 'Microsoft.Communication/emailServices/domains@2023-04-01' = {
  parent: email
  name: domainName
  location: 'global'
  properties: {
    domainManagement: 'CustomerManaged'
    userEngagementTracking: 'Disabled'
  }
}
resource sender 'Microsoft.Communication/emailServices/domains/senderUsernames@2023-04-01' = {
  parent: domain
  name: senderName
  properties: {
    displayName: 'Reunite Now'
    username: senderName
  }
}
output senderAddress string = '${senderName}@${domainName}'
output verificationRecords object = domain.properties.verificationRecords
