import type { Meta, StoryObj } from '@storybook/react-vite'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from './card'
import { Button } from './button'
import { Badge } from './badge'
import { Progress } from './progress'

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  parameters: { layout: 'centered' },
}
export default meta
type Story = StoryObj<typeof Card>

export const Basic: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Project Overview</CardTitle>
        <CardDescription>Store Technology Portfolio</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Track and manage all projects across domains, teams, and members in one place.
        </p>
      </CardContent>
    </Card>
  ),
}

export const WithFooter: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Inventory Modernization</CardTitle>
        <CardDescription>Platform & Infrastructure</CardDescription>
        <CardAction>
          <Badge>In Progress</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Migrating legacy inventory system to cloud-native microservices architecture.
        </p>
        <Progress value={65} />
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm" variant="outline">View Details</Button>
        <Button size="sm">Edit</Button>
      </CardFooter>
    </Card>
  ),
}

export const SmallSize: Story = {
  render: () => (
    <Card size="sm" className="w-72">
      <CardHeader>
        <CardTitle>Quick Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Active', value: '12' },
            { label: 'Blocked', value: '3' },
            { label: 'Complete', value: '28' },
            { label: 'Backlog', value: '7' },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  ),
}

export const Grid: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 w-[600px]">
      {['Store Experience', 'Inventory & Supply Chain', 'Platform & Infrastructure', 'Fulfillment'].map(domain => (
        <Card key={domain} size="sm">
          <CardHeader>
            <CardTitle>{domain}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">3 teams · 14 members · 22 projects</p>
          </CardContent>
        </Card>
      ))}
    </div>
  ),
}
