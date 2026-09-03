namespace SalesEvaluation.Api.Tests;

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using SalesEvaluation.Contracts.Territories;
using SalesEvaluation.Domain.Enums;
using Xunit;

public class TerritoryGroupEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;
    private readonly HttpClient _client;

    public TerritoryGroupEndpointsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    private void SetBearerToken(string token)
    {
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    private static StringContent JsonBody(object payload) =>
        new(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

    private async Task<TerritoryGroupDto> CreateGroupAsync(string name)
    {
        var response = await _client.PostAsync("/territory-groups", JsonBody(new { name }));
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<TerritoryGroupResponse>();
        return result!.TerritoryGroup;
    }

    [Fact]
    public async Task GetTerritoryGroups_IncludesMembersWithTerritory()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.GetAsync("/territory-groups");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<TerritoryGroupsResponse>();
        Assert.NotNull(result);

        var group = result.TerritoryGroups.FirstOrDefault(g => g.Id == _factory.TerritoryGroupId1);
        Assert.NotNull(group);
        Assert.Equal("กลุ่มเขต A", group.Name);
        Assert.True(group.IsActive);

        // another test in this class may add members — pick the seeded one by id
        var member = group.Members.Single(m => m.Id == _factory.GroupMemberId1);
        Assert.Equal(_factory.TerritoryId1, member.TerritoryId);
        Assert.Equal("ภาคเหนือ", member.Territory.Name);
        Assert.Null(member.EffectiveTo);
    }

    [Fact]
    public async Task PostTerritoryGroup_WithManagerToken_Creates201()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.PostAsync("/territory-groups", JsonBody(new { name = "กลุ่มใหม่", note = "โน้ต" }));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<TerritoryGroupResponse>();
        Assert.Equal("กลุ่มใหม่", result!.TerritoryGroup.Name);
        Assert.True(result.TerritoryGroup.IsActive);
        Assert.Empty(result.TerritoryGroup.Members);
    }

    [Fact]
    public async Task PostTerritoryGroup_WithSalespersonToken_Returns403()
    {
        SetBearerToken(_factory.CreateToken(_factory.SalespersonUserId, UserRole.SALESPERSON));

        var response = await _client.PostAsync("/territory-groups", JsonBody(new { name = "X" }));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task PatchTerritoryGroup_RenamesAndReturns200()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var group = await CreateGroupAsync("กลุ่มก่อนแก้");
        var response = await _client.PatchAsync($"/territory-groups/{group.Id}", JsonBody(new { name = "กลุ่มหลังแก้", isActive = false }));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var result = await response.Content.ReadFromJsonAsync<TerritoryGroupResponse>();
        Assert.Equal("กลุ่มหลังแก้", result!.TerritoryGroup.Name);
        Assert.False(result.TerritoryGroup.IsActive);
    }

    [Fact]
    public async Task PatchTerritoryGroup_WithNonExistentId_Returns404()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.PatchAsync("/territory-groups/99999", JsonBody(new { name = "X" }));
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PostGroupMember_AddsMemberAndRejectsOverlaps()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        // terr-2 joins the seeded group — 201
        var add = await _client.PostAsync($"/territory-groups/{_factory.TerritoryGroupId1}/members", JsonBody(new
        {
            territoryId = _factory.TerritoryId2,
            effectiveFrom = "2026-01-01"
        }));
        Assert.Equal(HttpStatusCode.Created, add.StatusCode);

        var added = await add.Content.ReadFromJsonAsync<GroupMemberResponse>();
        Assert.Equal(_factory.TerritoryId2, added!.Member.TerritoryId);
        Assert.Equal("ภาคกลาง", added.Member.Territory.Name);

        // The same territory cannot overlap into a second group over the same period → 409
        var groupB = await CreateGroupAsync("กลุ่ม B");
        var overlap = await _client.PostAsync($"/territory-groups/{groupB.Id}/members", JsonBody(new
        {
            territoryId = _factory.TerritoryId2,
            effectiveFrom = "2026-01-01"
        }));
        Assert.Equal(HttpStatusCode.Conflict, overlap.StatusCode);
        Assert.Contains("เป็นสมาชิกของกลุ่มเขตอื่นในช่วง", await overlap.Content.ReadAsStringAsync());

        // Group not found → 404
        var missing = await _client.PostAsync("/territory-groups/99999/members", JsonBody(new
        {
            territoryId = _factory.TerritoryId2,
            effectiveFrom = "2026-01-01"
        }));
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    [Fact]
    public async Task PostGroupMember_MonthAlignmentValidation_Returns400()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var notFirstDay = await _client.PostAsync($"/territory-groups/{_factory.TerritoryGroupId1}/members", JsonBody(new
        {
            territoryId = _factory.TerritoryId2,
            effectiveFrom = "2026-01-15"
        }));
        Assert.Equal(HttpStatusCode.BadRequest, notFirstDay.StatusCode);
        Assert.Contains("effectiveFrom ต้องเป็นวันแรกของเดือน", await notFirstDay.Content.ReadAsStringAsync());

        var notLastDay = await _client.PostAsync($"/territory-groups/{_factory.TerritoryGroupId1}/members", JsonBody(new
        {
            territoryId = _factory.TerritoryId2,
            effectiveFrom = "2027-01-01",
            effectiveTo = "2027-12-30"
        }));
        Assert.Equal(HttpStatusCode.BadRequest, notLastDay.StatusCode);
        Assert.Contains("effectiveTo ต้องเป็นวันสุดท้ายของเดือน", await notLastDay.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task PatchGroupMember_UpdatesPeriodAndDetectsOverlap()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        // Fresh territory + two groups so this test does not depend on other tests' mutations
        var territory = await (await _client.PostAsync("/territories", JsonBody(new { name = "เขตกลุ่มชั่วคราว" })))
            .Content.ReadFromJsonAsync<TerritoryResponse>();
        var groupB = await CreateGroupAsync("กลุ่ม B อัปเดต");
        var groupC = await CreateGroupAsync("กลุ่ม C อัปเดต");

        var add = await _client.PostAsync($"/territory-groups/{groupB.Id}/members", JsonBody(new
        {
            territoryId = territory!.Territory.Id,
            effectiveFrom = "2027-01-01",
            effectiveTo = "2027-12-31"
        }));
        Assert.Equal(HttpStatusCode.Created, add.StatusCode);
        var member = (await add.Content.ReadFromJsonAsync<GroupMemberResponse>())!.Member;

        // Plain period update — 200
        var patch = await _client.PatchAsync($"/territory-groups/{groupB.Id}/members/{member.Id}", JsonBody(new
        {
            effectiveFrom = "2027-02-01",
            effectiveTo = "2027-03-31"
        }));
        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);

        var updated = await patch.Content.ReadFromJsonAsync<GroupMemberResponse>();
        Assert.Equal("2027-02-01", updated!.Member.EffectiveFrom.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture));
        Assert.Equal("2027-03-31", updated.Member.EffectiveTo!.Value.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture));

        // terr-X joins group C later in 2027 (no overlap with Feb–Mar)
        var addC = await _client.PostAsync($"/territory-groups/{groupC.Id}/members", JsonBody(new
        {
            territoryId = territory.Territory.Id,
            effectiveFrom = "2027-06-01",
            effectiveTo = "2027-12-31"
        }));
        Assert.Equal(HttpStatusCode.Created, addC.StatusCode);

        // Moving the group B membership into Jun–Dec collides with group C → 409
        var overlap = await _client.PatchAsync($"/territory-groups/{groupB.Id}/members/{member.Id}", JsonBody(new
        {
            effectiveFrom = "2027-06-01",
            effectiveTo = "2027-12-31"
        }));
        Assert.Equal(HttpStatusCode.Conflict, overlap.StatusCode);
        Assert.Contains("เป็นสมาชิกของกลุ่มเขตอื่นในช่วง", await overlap.Content.ReadAsStringAsync());

        // effectiveTo before effectiveFrom on the merged period → 409
        var inverted = await _client.PatchAsync($"/territory-groups/{groupB.Id}/members/{member.Id}", JsonBody(new
        {
            effectiveTo = "2027-01-31"
        }));
        Assert.Equal(HttpStatusCode.Conflict, inverted.StatusCode);
        Assert.Contains("effectiveTo ต้องไม่ก่อน effectiveFrom", await inverted.Content.ReadAsStringAsync());

        // Member not found → 404
        var missing = await _client.PatchAsync($"/territory-groups/{groupB.Id}/members/99999", JsonBody(new
        {
            effectiveTo = "2027-12-31"
        }));
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    [Fact]
    public async Task PatchGroupMember_WithEmptyBody_Returns400()
    {
        SetBearerToken(_factory.CreateToken(_factory.ManagerUserId, UserRole.MANAGER));

        var response = await _client.PatchAsync($"/territory-groups/{_factory.TerritoryGroupId1}/members/{_factory.GroupMemberId1}", JsonBody(new { }));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("ต้องระบุช่วงเวลาที่ต้องการแก้ไข", await response.Content.ReadAsStringAsync());
    }
}
